import AbstractView from './AbstractView.js';

export default class extends AbstractView {
  constructor(params) {
    super(params);
    this.setTitle("Escrowing your NFT");
  }

  /*This function contain all the javascript code which will be executed when this view if selected */
  initCode(model){
    //Define global functions. Only for code reuse purpose.
    let bridgeApp = model.bridgeApp;
    let ABIS = model.ABIS;
    let contracts = model.contracts;
    let migData = model.migrationData;
    let migrationHashSigned = "";
    let account = window.web3.currentProvider.selectedAddress;
    let loadingText = document.getElementById("RegistrationLoadingText");

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    let migrationHashListener = async function(){
      //Construct XHR request
      let selectedRelayIndex = migData.migrationRelayIndex;
      let relayURL = bridgeApp.relays[selectedRelayIndex].url;
      let destinationNetworkId = bridgeApp.networks[migData.destinationUniverseIndex].networkID.toString(16);

      //Create HTTP request
      var options = {
        method: 'POST',
        url: '',
        headers: {'Content-Type': 'application/json'},
        data: {}
      };
      options.url = relayURL + '/pollingMigration';
      options.data.migrationId = model.readCookie("migrationId");

      let requestCallback = function(response){
        if(response.status == 200){
          let res = response.data;
          //If migration Hash received from relay
          if(res.migrationHash != undefined){
            model.migrationHash = res.migrationHash;
            console.log("Migration hash received: " + model.migrationHash);

            loadingText.textContent = "Please sign the migration data hash to continue the migration.";

            //Then sign migration hash
            signMigrationHash();
          }
        }else{console.log(response.status + ' : ' + response.statusText);}
      }

      console.log("Start listening for migration hash");

      //MIG ID NOT RECEIVED

      //Wait until timeout or migrationHash received
      let i = 0;
      while(i < model.listeningTimeOut/model.listeningRefreshFrequency && model.migrationHash == ""){
        await sleep(model.listeningRefreshFrequency*1000);
        //Ask relay for migration hash
        axios.request(options).then(function (response) {
          requestCallback(response);
        }).catch(function (error) {
          console.error(error);
        });
      }

      //If timeout: error message
      if(model.migrationHash == ""){
        loadingText.textContent = "Couldn't retrieve migration data hash from relay.";
      }
    }
    //Will call signMigrationHash once migration hash is received, which will call continueMigration once signed by user
    //signMigrationHash() -> continueMigration() -> escrowHashListener() -> /sign_escrow
    migrationHashListener();

    let signMigrationHash = async function(){
      model.migrationHash = 'blblblblbl';//FOR TEST PURPOSE

      window.web3.eth.sign(model.migrationHash, account, function(err,res){
        //If user refused to sign
        if(err){
          loadingText.textContent = "Signature refused.";
        }else{
          loadingText.textContent = "Sending migration data hash signed to relay";
          migrationHashSigned = res;
          continueMigration();
        }
      });
    }

    let continueMigration = async function(){
      let selectedRelayIndex = migData.migrationRelayIndex;
      let relayURL = bridgeApp.relays[selectedRelayIndex].url;
      let destinationNetworkId = bridgeApp.networks[migData.destinationUniverseIndex].networkID.toString(16);

      var options = {
        method: 'POST',
        url: '',
        headers: {'Content-Type': 'application/json'},
        data: {}
      };
      options.url = relayURL + '/continueMigration';
      options.data.migrationId = model.readCookie("migrationId");
      options.data.migrationHashSignature = migrationHashSigned;

      axios.request(options).then(function (response) {
        if(response.status == 200){
          //start listening relay for escrow hash
          escrowHashListener();
        }else{
          loadingText.textContent = "Relay not responding.";
          console.log(response.status + ' : ' + response.statusText);
        }

      }).catch(function (error) {
        console.error(error);
      });
    }

    let escrowHashListener = async function(){
      //Construct XHR request
      let selectedRelayIndex = migData.migrationRelayIndex;
      let relayURL = bridgeApp.relays[selectedRelayIndex].url;
      let destinationNetworkId = bridgeApp.networks[migData.destinationUniverseIndex].networkID.toString(16);

      var options = {
        method: 'POST',
        url: '',
        headers: {'Content-Type': 'application/json'},
        data: {}
      };
      options.url = relayURL + '/pollingMigration';
      options.data.migrationId = model.readCookie("migrationId");

      let requestCallback = function(response){
        if(response.status == 200){
          let res = response.data;
          //If migration Hash received from relay
          if(res.escrowHash != undefined){
            model.escrowHash = res.escrowHash;
            console.log("Escrow hash received: " + model.escrowHash);

            //Then move to signEscrow page
            model.navigateTo("/sign_escrow");
          }
        }else{console.log(response.status + ' : ' + response.statusText);}
      }

      console.log("Start listening for escrow hash");

      //Wait until timeout or migrationHash received
      let i = 0;
      while(i < model.listeningTimeOut/model.listeningRefreshFrequency && model.escrowHash == ""){
        await sleep(model.listeningRefreshFrequency);
        //Ask relay for migration hash
        axios.request(options).then(function (response) {
          requestCallback(response);
        }).catch(function (error) {
          console.error(error);
        });
      }

      //If timeout: error message
      if(model.escrowHash == ""){
        loadingText.textContent = "Couldn't retrieve escrow hash from relay.";
      }
    }

    //setTimeout(() => { model.navigateTo("/sign_escrow"); }, 5000);
  }

  async getHtml(callback){
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        let htmlContent = xhr.response;
        callback(htmlContent);
      }
    };
    xhr.open('GET', '/site/static_views/EscrowToken.html');
    xhr.send();
  }
}
