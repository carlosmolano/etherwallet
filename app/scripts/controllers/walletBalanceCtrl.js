'use strict';
var walletBalanceCtrl = function($scope, $sce, walletService) {
    $scope.ajaxReq = ajaxReq;
    $scope.erc20Abi = require('../abiDefinitions/erc20abi.json');
    $scope.erc20Indexes = {
      DECIMALS: 2,
      SYMBOL: 3,
    }
    $scope.tokensLoaded = true;
    $scope.localToken = {
        contractAdd: "",
        symbol: "",
        decimals: "",
        type: "custom",
    };
    $scope.contract = {
        functions: [],
    };
    $scope.slide = 2;
    $scope.alternativeBalance = {
        ETH: {
          balance: "Loading",
          node: "eth_ethscan",
          symbol: "ETH"
        },
        ETC: {
          balance: "Loading",
          node: "etc_epool",
          symbol: "ETC"
        },
        UBQ: {
          balance: "Loading",
          node: "ubq",
          symbol: "UBQ"
        },
        EXP: {
          balance: "Loading",
          node: "exp",
          symbol: "EXP"
        },
    }
    walletService.wallet = null;
    $scope.wallet = null;
    $scope.nodeList = nodes.nodeList;

    $scope.customTokenField = false;

    $scope.$watch(function() {
        if (walletService.wallet == null) return null;
        return walletService.wallet.getAddressString();
    }, function() {
        if (walletService.wallet == null) return;
        $scope.wallet = walletService.wallet;
    });

    $scope.saveTokenToLocal = function() {
        globalFuncs.saveTokenToLocal($scope.localToken, function(data) {
            if (!data.error) {
                $scope.localToken = {
                    contractAdd: "",
                    symbol: "",
                    decimals: "",
                    type: "custom"
                };
                $scope.wallet.setTokens();
                $scope.validateLocalToken = $sce.trustAsHtml('');
                $scope.customTokenField = false;
            } else {
                $scope.notifier.danger(data.msg);
            }
        });
    }

    $scope.initContract = function() {
        try {
            $scope.contract.functions = [];
            var tAbi = $scope.erc20Abi;
            for (var i in tAbi)
                if (tAbi[i].type == "function") {
                    tAbi[i].inputs.map(function(i) { i.value = ''; });
                    $scope.contract.functions.push(tAbi[i]);
                }
        } catch (e) {
            $scope.notifier.danger(e);
        }
    }

    $scope.getTxData = function(indexFunc) {
      var curFunc = $scope.contract.functions[indexFunc];
      var fullFuncName = ethUtil.solidityUtils.transformToFullName(curFunc);
      var funcSig = ethFuncs.getFunctionSignature(fullFuncName);
      var typeName = ethUtil.solidityUtils.extractTypeName(fullFuncName);
      var types = typeName.split(',');
      types = types[0] == "" ? [] : types;
      var values = [];
      for (var i in curFunc.inputs) {
          if (curFunc.inputs[i].value) {
              if (curFunc.inputs[i].type.indexOf('[') !== -1 && curFunc.inputs[i].type.indexOf(']') !== -1) values.push(curFunc.inputs[i].value.split(','));
              else values.push(curFunc.inputs[i].value);
          } else values.push('');
      }
      return '0x' + funcSig + ethUtil.solidityCoder.encodeParams(types, values);
    }

    $scope.readData = function(indexFunc, data) {
      if (!data.error) {
          var curFunc = $scope.contract.functions[indexFunc];
          var outTypes = curFunc.outputs.map(function(i) {
              return i.type;
          });
          var decoded = ethUtil.solidityCoder.decodeParams(outTypes, data.data.replace('0x', ''));
          for (var i in decoded) {
              if (decoded[i] instanceof BigNumber) curFunc.outputs[i].value = decoded[i].toFixed(0);
              else curFunc.outputs[i].value = decoded[i];
          }
      } else throw data.msg;
      return curFunc;
    }

    $scope.$watch(function() { return $scope.addressDrtv.ensAddressField; }, function (newAddress, oldAddress) {
        if (!$scope.Validator) return;
        if ($scope.Validator.isValidAddress(newAddress)) {
            ajaxReq.getEthCall({ to: newAddress, data: $scope.getTxData($scope.erc20Indexes.SYMBOL) }, function(data) {
                if (!data.error && data.data !== '0x') {
                    $scope.localToken.symbol = $scope.readData($scope.erc20Indexes.SYMBOL, data).outputs[0].value;
                } else {
                    $scope.notifier.danger('This address is not a token contract.');
                    $scope.localToken.symbol = '';
                }
            });
            ajaxReq.getEthCall({ to: newAddress, data: $scope.getTxData($scope.erc20Indexes.DECIMALS) }, function(data) {
                if (!data.error && data.data !== '0x') {
                    $scope.localToken.decimals = $scope.readData($scope.erc20Indexes.DECIMALS, data).outputs[0].value;
                } else {
                    $scope.localToken.decimals = '';
                }
            });
        }
    });

    /*
    $scope.$watch('wallet', function() {
        if ($scope.wallet) $scope.reverseLookup();
    });

    $scope.reverseLookup = function() {
        var _ens = new ens();
        _ens.getName($scope.wallet.getAddressString().substring(2) + '.addr.reverse', function(data) {
            if (data.error) uiFuncs.notifier.danger(data.msg);
            else if (data.data == '0x') {
                $scope.showens = false;
            } else {
                $scope.ensAddress = data.data;
                $scope.showens = true;
            }
        });
    }
    */

    $scope.$watch('wallet.balance', function() {
        if ($scope.wallet !== null) {
            $scope.setAllBalance();
        }
    });

    $scope.setAllBalance = function() {
        if (!$scope.nodeList) return;
        var setBalance = function (currency) {
          return function (data) {
              if (data.error) {
                  $scope.alternativeBalance[currency].balance = data.msg;
              } else {
                  $scope.alternativeBalance[currency].balance = etherUnits.toEther(data.data.balance, 'wei');
              }
          };
        };
        for (var currency in $scope.alternativeBalance) {
            $scope.nodeList[$scope.alternativeBalance[currency].node].lib.getBalance(
                $scope.wallet.getAddressString(), setBalance(currency),
            )
        }
    }

    $scope.removeTokenFromLocal = function(tokensymbol) {
        globalFuncs.removeTokenFromLocal(tokensymbol, $scope.wallet.tokenObjs);
    }

    $scope.showDisplayOnTrezor = function() {
        return ($scope.wallet != null && $scope.wallet.hwType === 'trezor');
    }

    $scope.displayOnTrezor = function() {
        TrezorConnect.ethereumGetAddress($scope.wallet.path, function() {});
    }

    $scope.showDisplayOnLedger = function() {
        return ($scope.wallet != null && $scope.wallet.hwType === 'ledger');
    }

    $scope.displayOnLedger = function() {
        var app = new ledgerEth($scope.wallet.getHWTransport());
        app.getAddress($scope.wallet.path, function(){}, true, false);
    }

};
module.exports = walletBalanceCtrl;
