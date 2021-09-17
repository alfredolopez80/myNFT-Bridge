/*
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>

 */

// IP compliant NFT bridge.
// Author : Guillaume Gonnaud

// ---------------------------------------------------- Loading GUI -------------------------------------------
//Loading the EVM networks the bridge can interact with
var bridgeApp = {};

var loadNets = async function (_callback) {
    bridgeApp.networks = [];
    bridgeApp.net = {};

    let pathNetworksJson = '/network_list.json';
    try {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', pathNetworksJson);

        xhr.onload = function () {
            if (xhr.status != 200) { // analyze HTTP status of the response
                console.log(`Error ${xhr.status}: ${xhr.statusText}`); // e.g. 404: Not Found
                alert("Could not load network list at " + pathNetworksJson);
            } else { // show the result
                //console.log(`Done, got ${xhr.response}`); // responseText is the server
                var resp = xhr.response;
                bridgeApp.networks = JSON.parse(resp).networks;

                //Create a mapping from networkUniqueID
                for (var i = 0; i < bridgeApp.networks.length; i++) {
                    bridgeApp.net[bridgeApp.networks[i].uniqueId] = bridgeApp.networks[i];
                } //You can now access Mainnet network data by calling bridgeApp.net.0x6d2f0e37


                _callback();

            }
        };

        xhr.send();
    } catch (err) {
        console.log(err);
        alert("Could not load network list at " + pathNetworksJson);

    };
}

//Load the networks and change the dropdown options based on the list
loadNets(function () {
    var selector = document.getElementById("OriginNetworkSelector");

    //Instanciate select options
    for (var i = 0; i < bridgeApp.networks.length; i++) {
        selector.options[i] = new Option(bridgeApp.networks[i].name, bridgeApp.networks[i].uniqueId);
    }
});

// ---------------------------------------------- LOADING ABIS -------------------------------------------
//Loading the ABI
var ABIS = {};
var loadERC721ABI = async function () {
    let pathERC721ABI = '/ABI/ERC721.json';
    try {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', pathERC721ABI);
        xhr.onload = function () {
            if (xhr.status != 200) { // analyze HTTP status of the response
                console.log(`Error ${xhr.status}: ${xhr.statusText}`); // e.g. 404: Not Found
                alert("Could not load network list at " + pathERC721ABI);
            } else { // show the result
                //console.log(`Done, got ${xhr.response}`); // responseText is the server
                var resp = xhr.response;
                ABIS.ERC721 = JSON.parse(resp).abi;
            }
        };
        xhr.send();
    } catch (err) {
        console.log(err);
        alert("Could not ERC721 ABI at " + pathERC721ABI);
    };
}
loadERC721ABI();

var loadERC721MetadataABI = async function () {
    let pathERC721Metadata = '/ABI/ERC721Metadata.json';
    try {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', pathERC721Metadata);
        xhr.onload = function () {
            if (xhr.status != 200) { // analyze HTTP status of the response
                console.log(`Error ${xhr.status}: ${xhr.statusText}`); // e.g. 404: Not Found
                alert("Could not load network list at " + pathERC721Metadata);
            } else { // show the result
                //console.log(`Done, got ${xhr.response}`); // responseText is the server
                var resp = xhr.response;
                ABIS.ERC721Metadata = JSON.parse(resp).abi;
            }
        };
        xhr.send();
    } catch (err) {
        console.log(err);
        alert("Could not ERC721Metadata ABI at " + pathERC721Metadata);
    };
}
loadERC721MetadataABI();

// ---------------------------------------------- Token Interactions -------------------------------------------


var originalChainERC721Contract = {};
var originalChainERC721MetadataContract = {};
//Loading a token metadata
var loadOgTokenData = async function () {

    //First we check that we have a connected wallet
    if (window.ethereum == undefined) {
        alert("Please connect to a Wallet first");
        return;
    }

    if (web3.currentProvider.selectedAddress == null) {
        alert("Please connect to a Wallet first");
        return;
    }

    let ogEthNetwork = bridgeApp.net[document.getElementById("OriginNetworkSelector").value];

    if (parseInt(web3.currentProvider.chainId) != parseInt(ogEthNetwork.chainID)) {
        alert("Please connect to the original token network in your web3 provider");
        return;
    }

    //Instanciate an ERC721 contract at the address
    originalChainERC721Contract = new web3.eth.Contract(ABIS.ERC721, document.getElementById("inputOGContractAddress").value);
    originalChainERC721MetadataContract = new web3.eth.Contract(ABIS.ERC721Metadata, document.getElementById("inputOGContractAddress").value);

	//Get the Contract Name
    let getContractName = async function () {
        try {
			let content = await originalChainERC721MetadataContract.methods.name().call();
			if(content != null){
				document.getElementById("OGContractName").innerHTML = content;
			} else {
				document.getElementById("OGContractName").innerHTML = "Not Specified";
			}
            
        } catch (err) {
			console.log(err);
			console.log("Could not get name() for: contractAddress" + originalChainERC721MetadataContract._address + "   tokenID:" + document.getElementById("inputOGTokenID").value);
		}
    }
    getContractName();
	
	//Get the Contract Symbol
    let getContractSymbol = async function () {
        try {
			let content = await originalChainERC721MetadataContract.methods.symbol().call();
			if(content != null){
				document.getElementById("OGContractSymbol").innerHTML = content;
			} else {
				document.getElementById("OGContractSymbol").innerHTML = "Not Specified";
			}
            
        } catch (err) {
			console.log(err);
			console.log("Could not get symbol() for: contractAddress" + originalChainERC721MetadataContract._address + "   tokenID:" + document.getElementById("inputOGTokenID").value);
		}
    }
    getContractSymbol();
	

    //Get the Token owner
    let getTokenOwner = async function () {
        try {
			let content = await originalChainERC721Contract.methods.ownerOf(document.getElementById("inputOGTokenID").value).call();
			if(content != null){
				document.getElementById("OGTokenOwner").innerHTML = content;
			} else {
				document.getElementById("OGTokenOwner").innerHTML = "Not Specified";
			}
            
        } catch (err) {
			console.log(err);
			console.log("Could not get ownerOf() for: contractAddress" + originalChainERC721Contract._address + "   tokenID:" + document.getElementById("inputOGTokenID").value);
		
		}
    }
    getTokenOwner();
	
	//Get the Token URI
    let getTokenURI = async function () {
        try {
			let content = await originalChainERC721MetadataContract.methods.tokenURI(document.getElementById("inputOGTokenID").value).call();
			if(content != null){
				document.getElementById("OGTokenURI").innerHTML = content;
                loadOgTokenMetaData();
			} else {
				document.getElementById("OGTokenURI").innerHTML = "Not Specified";
			}
            
        } catch (err) {
			console.log(err);
			console.log("Could not get tokenURI() for: contractAddress" + originalChainERC721MetadataContract._address + "   tokenID:" + document.getElementById("inputOGTokenID").value);
		
		}
    }
    getTokenURI();
	
}

var loadOgTokenMetaData = async function () {

    let OGTokenMetadataPath = document.getElementById("OGTokenURI").innerHTML;
    var ogTokenData = {};
    if(OGTokenMetadataPath == "Not Specified" || OGTokenMetadataPath == null){
        return;
    } else {
        console.log("sending XHR");
        try {
            let xhr = new XMLHttpRequest();
            xhr.open('GET', OGTokenMetadataPath);
            xhr.onload = function () {
                if (xhr.status != 200) { // analyze HTTP status of the response
                    console.log(`Error ${xhr.status}: ${xhr.statusText}`); // e.g. 404: Not Found
                    alert("Could not load network list at " + pathERC721Metadata);
                } else { // show the result
                    //console.log(`Done, got ${xhr.response}`); // responseText is the server
                    var resp = xhr.response;
                    ogTokenData = JSON.parse(resp);
                    console.log(resp);

                    document.getElementById("OGTokenMetaName").textContent = ogTokenData.name;
                    document.getElementById("OGTokenMetaDesc").textContent = ogTokenData.description;

                    //Img loading
                    let ext4 = ogTokenData.image.substr(ogTokenData.image.length - 4).toLowerCase();
                    if(ext4 == ".png" || ext4 == ".jpg" || ext4 == "jpeg" || ext4 == ".gif" || ext4 == "webp" || ext4== ".svg" || ext4 == "jfif"){
                        document.getElementById("OGTokenMetaImagePath").innerHTML = '<br><img class="imgassetpreview" src="' + encodeURI(ogTokenData.image) +'">';
                    } else if(ogTokenData.image != null) {
                        document.getElementById("OGTokenMetaImagePath").innerHTML = '<a href="' + encodeURI(ogTokenData.image) + '">' + encodeURI(ogTokenData.image) + '>';
                    }
                   

                }
            };
            xhr.send();
        } catch (err) {
            console.log(err);
            alert("Could not ERC721Metadata ABI at " + pathERC721Metadata);
        };

    }



}



var endLoadMetamaskConnection = async function () {
    //Connecting to metmask if injected
    if (web3.__isMetaMaskShim__ && web3.currentProvider.selectedAddress != null) {
        if (connector == null || !connector.isConnected) {
            connector = await ConnectorManager.instantiate(ConnectorManager.providers.METAMASK);
            connectedButton = connectMetaMaskButton;
            providerConnected = "MetaMask";
            connection();
        } else {
            connector.disconnection();
        }
    }

}
setTimeout(endLoadMetamaskConnection, 500);