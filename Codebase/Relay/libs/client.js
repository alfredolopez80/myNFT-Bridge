const Logger = require('./winston.js')('Client')
const { Axios } = require('axios')
const Uuid = require('uuid')
const Ethereum = require('./blockhainModules/ethereum')
const Forge = require('./forge')

class Client {
    constructor(
        migrationData
        , originUniverse
        , destinationUniverse
        , originUniverseRpc
        , destinationUniverseRpc
        , db
        , id
        , step
    ){
        this.id = id ? id : Uuid.v4()
        this.date = (new Date()).getTime()
        this.step = step ? step : 'registered'
        this.db = db

        this.migrationData = migrationData
        this.originUniverse = originUniverse
        this.destinationUniverse = destinationUniverse

        this.originEthereumConnection = originUniverseRpc
        this.destinationEthereumConnection = destinationUniverseRpc

        if(!id)
            this.db.collections.clients.insert({
                id: this.id,
                step: this.step,
                migrationData: this.migrationData,
                originUniverse: this.originUniverse,
                destinationUniverse: this.destinationUniverse
            })

        this.dbObject = this.db.collections.clients.findOne({ id: this.id })

        Logger.info(id ? `Existing client reloaded with id ${this.id} at step ${this.step}` : `New client generated with id ${this.id}`)
    }

    async annonceToBridge(){
        this.step = 'annonceToBridge';
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)

        try {
            Logger.info(`Announcing to bridge the intent to migrate a token`)
            const { migrationHash, blockTimestamp } = await this.originEthereumConnection.migrateToERC721IOU(
                this.originUniverse.bridgeAdress,
                this.migrationData
            )
            if(!migrationHash)
                throw 'Undefined migrationHash'
            this.migrationHash = migrationHash
            this.blockTimestamp = blockTimestamp
            
            this.dbObject.migrationHash = this.migrationHash
            this.dbObject.blockTimestamp = this.blockTimestamp
            this.db.collections.clients.update(this.dbObject)
        } catch(e) {
            Logger.error(`Can't annonce intent to migrate to the departure bridge`)
        }
    }

    async transferToBridge(migrationHashSignature){
        this.step = 'transferToBridge';
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)

        this.migrationHashSignature = migrationHashSignature
        const owner = await this.originEthereumConnection.verifySignature(this.migrationHash, migrationHashSignature)
        await this.originEthereumConnection.safeTransferFrom(
            this.migrationData.originWorld,
            owner,
            this.originUniverse.bridgeAdress,
            this.migrationData.originTokenId
        )
    }

    async closeMigration(){
        this.step = 'closeMigration'
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)

        this.originalTokenUri = await this.originEthereumConnection.getTokenUri(this.migrationData.originWorld, this.migrationData.originTokenId)
        const IOUMetadataUrl = await (new Forge(this.db)).forgeIOUMetadata(this.originalTokenUri, this.migrationData)
        
        await this.destinationEthereumConnection.setTokenUri(this.migrationData.destinationWorld, this.migrationData.destinationTokenId, IOUMetadataUrl)

        this.creationTransferHash = (await this.destinationEthereumConnection.migrateFromIOUERC721ToERC721(
            this.originUniverse.bridgeAdress,
            this.migrationData,
            this.migrationHashSignature,
            this.blockTimestamp
        )).transactionHash
    }

    async closeRedeemMigration(){
        this.step = 'closeRedeemMigration'
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)

        this.creationTransferHash = (await this.destinationEthereumConnection.migrateFromIOUERC721ToERC721(
            this.originUniverse.bridgeAdress,
            this.migrationData,
            this.migrationHashSignature,
            this.blockTimestamp
        )).transactionHash
    }

    async registerTransferOnOriginBridge(escrowHashSigned){
        this.step = 'registerTransferOnOriginBridge'
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)

        await this.originEthereumConnection.registerEscrowHashSignature(
            this.originUniverse.bridgeAdress,
            this.migrationData,
            this.migrationHash,
            escrowHashSigned)
    }

    async verifyEscrowHashSigned(escrowHashSigned){
        this.step = 'verifyEscrowHashSigned'
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)

        const owner = await this.originEthereumConnection.verifySignature(this.escrowHash, escrowHashSigned);
        return owner == this.migrationData.originOwner;
    }

    async updateEscrowHash(){
        this.step = 'updateEscrowHash'
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)
        
        if(this.migrationHash) {
            this.escrowHash = await this.originEthereumConnection.getProofOfEscrowHash(this.originUniverse.bridgeAdress, this.migrationHash);
            this.dbObject.escrowHash = this.escrowHash
            this.db.collections.clients.update(this.dbObject)
        } else {
            throw "Invalid migrationHash"
        }
    }

    async transferBackOriginToken(){
        this.step = "canceled"
        this.dbObject.step = this.step
        this.db.collections.clients.update(this.dbObject)

        const originOwner = this.migrationData.originOwner;
        await ethereum.safeTransferFrom(
            this.migrationData.originWorld,
            this.originUniverse.bridgeAdress,
            originOwner,
            this.migrationData.originTokenId
        )
    }

    async getDestinationTokenUri(){
        return await this.destinationEthereumConnection.getTokenUri(this.migrationData.destinationWorld, this.migrationData.destinationTokenId)
    }

}

module.exports = Client
