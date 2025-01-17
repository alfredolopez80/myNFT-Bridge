import AbstractView from './AbstractView.js';

export default class extends AbstractView {
  constructor(params) {
    super(params);
    this.setTitle("myNFT Bridge - Register your migration");
  }

  /*This function contain all the javascript code which will be executed when this view if selected */
  initCode(model){
    //Define global functions. Only for code reuse purpose.
    let bridgeApp = model.bridgeApp;
    let ABIS = model.ABIS;
    let contracts = model.contracts;
    let migData = model.migrationData;
    let userAccount = "";

    //When user accept to switch, it will be asked to grant relay as operator of his NFT
    let promptSwitchChainThenGrantOperator = async function (ID) {
      window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ID}], // chainId must be in hexadecimal numbers
      }).then((res) =>{
        console.log("Network switch done.");
        grantRelayOperatorPrivilege();
      }).catch((res) => {
        console.log("Network switch canceled or error");
        alert("Please accept the metamask switch network prompt in order to continue your NFT migration.");
      });
    }
    //Once user accept to switch, it will be redirected to migration_form
    let promptSwitchChainThenEditForm = async function (ID) {
      window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ID}], // chainId must be in hexadecimal numbers
      }).then((res) =>{
        console.log("Network switch done.");
        model.navigateTo("/migration_form");
      }).catch((res) => {
        console.log("Network switch canceled or error");
        alert("Please accept the metamask switch network prompt in order to edit your migration.");
      });
    }

    //Ask user to grant the relay as an operator by calling approve from ERC721 contract
    let grantRelayOperatorPrivilege = async function(){
      try{
        let selectedRelayIndex = migData.migrationRelayIndex;
        let relayOgNetworkAddr = bridgeApp.relays[selectedRelayIndex].publicKey;
        let originTokenId = parseInt(migData.originTokenId);
        console.log("Ask user " + userAccount + " to grant relay " + relayOgNetworkAddr + " as an operator for the token " + originTokenId);

        contracts.originalChainERC721Contract.methods.approve(relayOgNetworkAddr, originTokenId)
        .send({from: userAccount, gas:100000}, function(error, transactionHash){
          //Function called when user accept or reject relay's operator approval
          if(error){
            console.log('Approval rejected by user');
            alert("Please approve the relay as an operator for this NFT.");
          }
          else{
            console.log('Approval accepted by user');
            //Delete cookies from previous migration, to let place to the new one which will me
            model.eraseCookie("migrationId");

            //If approval accepted by user: go to next page
            model.navigateTo("/escrow_token");
          }
        })
        .then((res) => {
          //Function called when transaction accepted on blockchain. Will be executed when page EscrowToken is displayed
          console.log("Relay is now an operator");

          //Call /initMigration from Relay
          initMigration();

          let loadingText = document.getElementById("RegistrationLoadingText");
          if(loadingText != null && loadingText != undefined){loadingText.textContent = "The migration is being registered on origin blockchain.";}
        }).catch((res) => {
          console.log("Operator approval canceled or error");
          console.log(res);

          let loadingText = document.getElementById("RegistrationLoadingText");
          if(loadingText != null && loadingText != undefined){loadingText.textContent = "Error during relay operator approval.";}

          alert("An error occured when approving the relay as an operator for your NFT. Make sure you are the owner of that token and to accept the approval operation. Current owner is " + migData.originOwner);
        });
      }catch(err){
        console.log("Error when setting relay as an operator: " + err);
      }
    }

    //relay's backend interactions.
    //Will be executed on EscrowToken page
    let initMigration = async function(){
      let selectedRelayIndex = migData.migrationRelayIndex;
      let relayURL = bridgeApp.relays[selectedRelayIndex].url;

      var options = {
        method: 'POST',
        url: '',
        headers: {'Content-Type': 'application/json'},
        data: {}
      };
      options.url = relayURL + '/initMigration';
      options.data.migrationData = {};
      options.data.migrationData.originUniverse = migData.originUniverseUniqueId;
      options.data.migrationData.originWorld = migData.originWorld;
      options.data.migrationData.originTokenId = migData.originTokenId;
      options.data.migrationData.originOwner = migData.originOwner;
      options.data.migrationData.destinationUniverse = migData.destinationUniverseUniqueId;
      options.data.migrationData.destinationBridge = migData.destinationBridgeAddr;
      options.data.migrationData.destinationWorld = migData.destinationWorld;
      options.data.migrationData.destinationTokenId = migData.destinationTokenId;
      options.data.migrationData.destinationOwner = migData.destinationOwner;
      options.data.operatorHash = "0x00";//Not used yet
      options.data.redeem = model.isRedeem;

      axios.request(options).then(function (response) {
        if(response.status == 200){
          let migId = response.data.migrationId;
          console.log("Migration initiated with migrationId: " + migId);
          //Add migrationID as cookie
          model.createCookie("migrationId", migId, 31);
        }else{console.log(response.status + ' : ' + response.statusText);}

      }).catch(function (error) {
        if(error.response.data){
          let loadingText = document.getElementById("RegistrationLoadingText");
          if(loadingText != null && loadingText != undefined){
            loadingText.textContent = error.response.data.status + ". Please contact our team.";
          }
        }
        console.error(error);
      });
    }

    //Display migration data from model.migData
    document.getElementById("OGNetworkRegistrationDisp").textContent = migData.originUniverse;
    document.getElementById("OGContractAddressRegistrationDisp").textContent = migData.originWorld;
    document.getElementById("OGTokenIDRegistrationDisp").textContent = migData.originTokenId;
    document.getElementById("OGTokenOwnerRegistrationDisp").textContent = migData.originOwner;
    document.getElementById("TokenNameRegistrationDisp").textContent = migData.originTokenName;

    document.getElementById("MigrationTypeRegistrationDisp").textContent = migData.migrationType;
    document.getElementById("MigrationRelayRegistrationDisp").textContent = migData.migrationRelay;

    document.getElementById("DestNetworkRegistrationDisp").textContent = migData.destinationUniverse;
    document.getElementById("DestContractAddressRegistrationDisp").textContent = migData.destinationWorld;
    document.getElementById("DestTokenIDRegistrationDisp").textContent = migData.destinationTokenId;
    document.getElementById("DestTokenOwnerRegistrationDisp").textContent = migData.destinationOwner;

    //Interface Buttons
    document.getElementById("EditMigrationButton").addEventListener('click', async() =>{
      promptSwitchChainThenEditForm('0x' + migData.originNetworkId.toString(16));
    });
    document.getElementById("RegisterButton").addEventListener('click', async() =>{
      //refresh user wallet account
      userAccount = window.web3.currentProvider.selectedAddress;

      //If not right account connected to wallet
      if(userAccount != migData.originOwner){
        alert("The NFT owner is " + migData.originOwner + ". Please connect to this account through your wallet.");
      }
      //Else, check wallet connected network, and prompt user to switch if wrong network.
      else if(parseInt(window.web3.currentProvider.chainId) != parseInt(migData.originNetworkId)){
        alert("The NFT you want to migrate is on the blochain " + migData.originUniverse + ". Please change the network you are connected to with your wallet.");
        promptSwitchChainThenGrantOperator('0x' + migData.originNetworkId.toString(16));
      }
      //Else: everything OK, launch migration registration
      else{
        grantRelayOperatorPrivilege();
      }
    });
  }

  async getHtml(callback){
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'text';
    xhr.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        let htmlContent = xhr.response;
        callback(htmlContent);
      }
    };
    xhr.open('GET', '/site/static_views/RegisterMigration.html');
    xhr.send();
  }
}
