// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.9;

import "../ImplMemoryStructure.sol";
import "../ERC721.sol";
import "../../MyNFTBridge.sol";

/// @author Guillaume Gonnaud 2021
/// @title ImplMyNFTBridgeFunMigrateToERC721
/// @notice The well-ordered memory structure of our bridge. Used for generating proper memory address at compilation.
contract ImplMyNFTBridgeFunMigrateToERC721  is ImplMemoryStructure {

    // Event emitted when an ERC-721 IOU migration is registered. 
    // Indexed parameter suppose that those events are gonna be parsed for checking provenance of a migrated token
    event MigrationDeparturePreRegisteredERC721IOU(
        address indexed _originWorld, 
        uint256 indexed _originTokenId, 
        address _originOwner,
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee,
        bytes32 indexed _migrationHash //Depend on all previous elements + _originWorld + isIOU
    );


    // Event emitted when an ERC-721 IOU migration is registered. 
    // Indexed parameter suppose that those events are gonna be parsed for checking provenance of a migrated token
    event MigrationDeparturePreRegisteredERC721Full(
        address indexed _originWorld, 
        uint256 indexed _originTokenId, 
        address _originOwner,
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee,
        bytes32 indexed _migrationHash //Depend on all previous elements + _originWorld + isNotIOU
    );


    /// @notice Declare the intent to migrate an ERC-721 token to a different bridge as an IOU token.
    /// Calling this functionIt will assume that the migrating owner is the current owner at function call.
    /// @dev Throw if _originWorld owner disabled IOU migrations for this world.
    /// Emit MigrationDeparturePreRegisteredERC721IOU
    /// Can be called by the owner of the ERC-721 token or one of it's operator/approved address
    /// The latest migration data would be bound to a token when the token is deposited in escrow
    /// @param _originWorld The smart contract address of the token currently representing the NFT
    /// @param _originTokenId The token ID of the token representing the NFT
    /// @param _destinationUniverse An array of 32 bytes representing the destination universe. 
    /// eg : "Ropsten", "Moonbeam". Please refer to the documentation for a standardized list of destination.
    /// @param _destinationBridge An array of 32 bytes representing the destination bridge. If the destination
    /// bridge is on an EVM, it is most likely an address.
    /// @param _destinationWorld An array of 32 bytes representing the destination world of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// @param _destinationTokenId An array of 32 bytes representing the tokenId world of the migrated token. 
    /// If the destination token is an ERC-721 token in an EVM smart contract, it is most likely an uint256.
    /// @param _destinationOwner An array of 32 bytes representing the final owner of the migrated token . 
    /// If the destination world is on an EVM, it is most likely an address.
    /// @param _signee The address that will be verified as signing the transfer as legitimate on the destination
    /// If the owner has access to a private key, it should be the owner.
    function migrateToERC721IOU(
        address _originWorld, 
        uint256 _originTokenId, 
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee
    ) external {
        //Checking token ownership

        //PUSH of tOwner for gas optimization
        address tOwner = ERC721(_originWorld).ownerOf(_originTokenId);

        // Note that if the bridge own the token, registering a new migration is not possible
        require(
            msg.sender == tOwner || 
            ERC721(_originWorld).isApprovedForAll(tOwner, msg.sender) ||
            msg.sender == ERC721(_originWorld).getApproved(_originTokenId),
            "msg.sender is not the token owner, an operator, or the accredited address for the token"
        );

        //Checking if IOU migrations are allowed for this world
        require(!isIOUForbidden[_originWorld], "The token creator have forbidden IOU migrations for this world");

        //Generating the migration hash
        bytes32 migrationHash = generateMigrationHashArtificialLocalIOU(   
            _originWorld, 
            _originTokenId, 
            tOwner,
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee
        );
 

        require(!migrationsRegistered[migrationHash], "This migration was already registered");

        //Registering the migration as pre-registered
        migrationsRegistered[migrationHash] = true;

        //Registering this migration address as the latest registered for a specific token (hashing less gas expensive than address + tokenID storing)
        latestRegisteredMigration[keccak256(abi.encodePacked(_originWorld, _originTokenId))] = migrationHash;

        //Emiting the registration event
        emit MigrationDeparturePreRegisteredERC721IOU(
            _originWorld, 
            _originTokenId, 
            tOwner,
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee,
            migrationHash
        );
    }


    /// @notice Declare the intent to migrate an ERC-721 token to a different bridge as a full migration.
    /// Calling this functionIt will assume that the migrating owner is the current owner at function call.
    /// @dev Throw if _originWorld owner has not set (_destinationUniverse, _destinationWorld) as an accepted
    /// migration.
    /// Will callback onFullMigration(_destinationWorld, _destinationTokenId);
    /// Emit MigrationDeparturePreRegisteredERC721Full
     /// Can be called by the owner of the ERC-721 token or one of it's operator/approved address
    /// @param _originWorld The smart contract address of the token currently representing the NFT
    /// @param _originTokenId The token ID of the token representing the NFT
    /// @param _destinationUniverse An array of 32 bytes representing the destination universe. 
    /// eg : "Ropsten", "Moonbeam". Please refer to the documentation for a standardized list of destination.
    /// @param _destinationBridge An array of 32 bytes representing the destination bridge. If the destination
    /// bridge is on an EVM, it is most likely an address.
    /// @param _destinationWorld An array of 32 bytes representing the destination world of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// @param _destinationTokenId An array of 32 bytes representing the tokenId world of the migrated token. 
    /// If the destination token is an ERC-721 token in an EVM smart contract, it is most likely an uint256.
    /// @param _destinationOwner An array of 32 bytes representing the final owner of the migrated token . 
    /// If the destination world is on an EVM, it is most likely an address.
    /// @param _signee The address that will be verified as signing the transfer as legitimate on the destination
    /// If the owner has access to a private key, it should be the owner.
    function migrateToERC721Full(
        address _originWorld, 
        uint256 _originTokenId, 
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee
    ) external {

        //Checking token ownership

        //PUSH of tokenOwner for gas optimization
        address tOwner = ERC721(_originWorld).ownerOf(_originTokenId);
        require(
            msg.sender == tOwner || 
            ERC721(_originWorld).isApprovedForAll(tOwner, msg.sender) ||
            msg.sender == ERC721(_originWorld).getApproved(_originTokenId),
            "msg.sender is not the token owner, an operator, or the accredited address for the token"
        );

        //Checking if a FULL migration is allowed for this specific migration
        require(
            FullMigrationController(fullMigrationsDelegates[_originWorld]).acceptableMigration(
                _originWorld,
                _originTokenId,
                _destinationUniverse,
                _destinationWorld,
                _destinationTokenId
            ),
            "This migration is not acceptable for the token creator"
        );

        bytes32 migrationHash = generateMigrationHashArtificialLocalFull(   
            _originWorld, 
            _originTokenId, 
            tOwner,
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee
        );

        require(!migrationsRegistered[migrationHash], "This migration was already registered");

        //Registering the migration as pre-registered
        migrationsRegistered[migrationHash] = true;

        //Registering this migration address as the latest registered for a specific token (hashing less gas expensive than address + tokenID storing)
        latestRegisteredMigration[keccak256(abi.encodePacked(_originWorld, _originTokenId))] = migrationHash;

        //Emiting the registration event
        emit MigrationDeparturePreRegisteredERC721Full(
            _originWorld, 
            _originTokenId, 
            tOwner,
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee,
            migrationHash
        );

    }


    /// @notice Query if a migration generating the given hash has been registered.
    /// @param _migrationHash The bytes32 migrationHash that would have been generated when pre-registering the migration
    /// @return TRUE if a migration generating such a hash was pre registered, FALSE if not.
    function isMigrationPreRegisteredERC721(bytes32 _migrationHash) external view returns(bool){
        return migrationsRegistered[_migrationHash];
    }


    /// @notice Get the latest proof of escrow hash associated with a migration hash.
    /// @dev Throw if the token has not been deposited yet. To prevent front running, please wrap the safeTransfer transaction 
    /// and check the deposit using this function.
    /// @param _migrationHash The bytes32 migrationHash that was generated when pre-registering the migration
    /// @return The proof of escrowHash associated with a migration (if any)
    function getProofOfEscrowHash(bytes32 _migrationHash) external view returns(bytes32){
        bytes32 poeh =  escrowHashOfMigrationHash[_migrationHash];
        require(poeh != 0x0, "The token associated with this migration hash have not been deposited yet");
        return poeh;
    }


    /// @notice Check if an origin NFT token can be migrated to a different token as an IOU migration
    /// @param _originWorld The smart contract address of the token currently representing the NFT
    /// _param _originTokenId The token ID of the token representing the NFT
    /// _param _destinationUniverse An array of 32 bytes representing the destination universe. 
    /// eg : "Ropsten", "Moonbeam". Please refer to the documentation for a standardized list of destination.
    /// _param _destinationWorld An array of 32 bytes representing the destination world of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// _param _destinationTokenId An array of 32 bytes representing the tokenId world of the migrated token. 
    /// If the destination token is an ERC-721 token in an EVM smart contract, it is most likely an uint256.
    /// @return TRUE if token can be migrated, FALSE if it can't.
    function acceptedMigrationDestinationERC721IOU(
        address _originWorld, 
        uint256 /*_originTokenId*/, 
        bytes32 /*_destinationUniverse*/, 
        bytes32 /*_destinationWorld*/,
        bytes32 /*_destinationTokenId*/
    ) external view returns(bool){
        //Either a departure world allows for IOU migration or it doesn't
        return(!isIOUForbidden[_originWorld]);
    }


    /// @notice Check if an origin NFT token can be migrated to a different token as a full migration
    /// @param _originWorld The smart contract address of the token currently representing the NFT
    /// @param _originTokenId The token ID of the token representing the NFT
    /// @param _destinationUniverse An array of 32 bytes representing the destination universe. 
    /// eg : "Ropsten", "Moonbeam". Please refer to the documentation for a standardized list of destination.
    /// @param _destinationWorld An array of 32 bytes representing the destination world of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// @param _destinationTokenId An array of 32 bytes representing the tokenId world of the migrated token. 
    /// If the destination token is an ERC-721 token in an EVM smart contract, it is most likely an uint256.
    /// @return TRUE if token can be migrated, FALSE if it can't.
    function acceptedMigrationDestinationERC721Full(
        address _originWorld, 
        uint256 _originTokenId, 
        bytes32 _destinationUniverse, 
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId
    ) external view returns(bool){
        return FullMigrationController(fullMigrationsDelegates[_originWorld]).acceptableMigration(
            _originWorld, 
            _originTokenId, 
            _destinationUniverse, 
            _destinationWorld, 
            _destinationTokenId
        );
    }

    
    /// @notice Generate a hash that would be generated when registering an IOU ERC721 migration
    /// @param _originUniverse The bytes32 identifier of the Universe this bridge is deployed in
    /// @param _originBridge the address of bridge the original token is gonna be in escrow with
    /// @param _originWorld The smart contract address of the original token representing the NFT
    /// @param _originTokenId The token ID of the original token representing the NFT
    /// @param _originOwner The original owner of the token when migration is registered
    /// @param _destinationUniverse An array of 32 bytes representing the destination universe. 
    /// eg : "Ropsten", "Moonbeam". Please refer to the documentation for a standardized list of destination.
    /// @param _destinationBridge An array of 32 bytes representing the destination bridge of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// @param _destinationWorld An array of 32 bytes representing the destination world of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// @param _destinationTokenId An array of 32 bytes representing the tokenId world of the migrated token. 
    /// If the destination token is an ERC-721 token in an EVM smart contract, it is most likely an uint256.
    /// @param _destinationOwner  An array of 32 bytes representing the final owner of the migrated token . 
    /// If the destination world is on an EVM, it is most likely an address.
    /// @param _signee The address that will be verified as signing the transfer as legitimate on the destination
    /// If the owner has access to a private key, it should be the owner.
    /// @param _originHeight The height of the origin universe (usually block.timestamp)
    /// If the owner has access to a private key, it should be the owner.
    /// @return The bytes32 migrationHash that would be generated in such a migration
    function generateMigrationHashERC721IOU(   
        bytes32 _originUniverse, 
        address _originBridge,
        address _originWorld, 
        uint256 _originTokenId, 
        address _originOwner,
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee,
        bytes32 _originHeight
    ) external pure returns (bytes32){
        return generateMigrationHashArtificial(   
            true,     
            _originUniverse, 
            bytes32(uint(uint160(address(_originBridge)))),
            bytes32(uint(uint160(_originWorld))), 
            bytes32(_originTokenId), 
            bytes32(uint(uint160(_originOwner))),
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee,
            _originHeight
        );
    }


    /// @notice Generate a hash that would be also generated when registering an IOU ERC721 migration with the same data
    /// @param _originUniverse The bytes32 identifier of the Universe this bridge is deployed in
    /// @param _originBridge the address of bridge the original token is gonna be in escrow with
    /// @param _originWorld The smart contract address of the original token representing the NFT
    /// @param _originTokenId The token ID of the original token representing the NFT
    /// @param _originOwner The original owner of the token when migration is registered
    /// @param _destinationUniverse An array of 32 bytes representing the destination universe. 
    /// eg : "Ropsten", "Moonbeam". Please refer to the documentation for a standardized list of destination.
    /// @param _destinationBridge An array of 32 bytes representing the destination bridge of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// @param _destinationWorld An array of 32 bytes representing the destination world of the migrated token. 
    /// If the destination bridge is on an EVM, it is most likely an address.
    /// @param _destinationTokenId An array of 32 bytes representing the tokenId world of the migrated token. 
    /// If the destination token is an ERC-721 token in an EVM smart contract, it is most likely an uint256.
    /// @param _destinationOwner  An array of 32 bytes representing the final owner of the migrated token . 
    /// If the destination world is on an EVM, it is most likely an address.
    /// @param _signee The address that will be verified as signing the transfer as legitimate on the destination
    /// If the owner has access to a private key, it should be the owner.
    /// @param _originHeight The height of the origin universe (usually block.timestamp)
    /// If the owner has access to a private key, it should be the owner.
    /// @return The bytes32 migrationHash that would be generated in such a migration
    function generateMigrationHashERC721Full(   
        bytes32 _originUniverse, 
        address _originBridge,
        address _originWorld, 
        uint256 _originTokenId, 
        address _originOwner,
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee,
        bytes32 _originHeight
    ) external pure returns (bytes32){
        return generateMigrationHashArtificial(   
            false,     
            _originUniverse, 
            bytes32(uint(uint160(address(_originBridge)))),
            bytes32(uint(uint160(_originWorld))), 
            bytes32(_originTokenId), 
            bytes32(uint(uint160(_originOwner))),
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee,
            _originHeight
        );
    }


    //Generate a migration hash for an IOU migration
    function generateMigrationHashArtificialLocalIOU(   
        address _originWorld, 
        uint256 _originTokenId, 
        address _originOwner,
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee
    ) internal view returns(bytes32){

        return generateMigrationHashArtificial(
            true,     
            localUniverse, 
            bytes32(uint(uint160(address(this)))),
            bytes32(uint(uint160(_originWorld))),  
            bytes32(_originTokenId), 
            bytes32(uint(uint160(_originOwner))),
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee,
            bytes32(block.timestamp)
        );
    }

    //Generate a migration hash for a full migration
    function generateMigrationHashArtificialLocalFull(   
        address _originWorld, 
        uint256 _originTokenId, 
        address _originOwner,
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee
    ) internal view returns(bytes32){

        return generateMigrationHashArtificial(
            true,     
            localUniverse, 
            bytes32(uint(uint160(address(this)))),
            bytes32(uint(uint160(_originWorld))),  
            bytes32(_originTokenId), 
            bytes32(uint(uint160(_originOwner))),
            _destinationUniverse,
            _destinationBridge,
            _destinationWorld,
            _destinationTokenId,
            _destinationOwner,
            _signee,
            bytes32(block.timestamp)
        );
    }
    

    //Generate a migration hash for a query
    function generateMigrationHashArtificial(   
        bool _isIOU,     
        bytes32 _originUniverse, 
        bytes32 _originBridge,
        bytes32 _originWorld, 
        bytes32 _originTokenId, 
        bytes32 _originOwner,
        bytes32 _destinationUniverse,
        bytes32 _destinationBridge,
        bytes32 _destinationWorld,
        bytes32 _destinationTokenId,
        bytes32 _destinationOwner,
        bytes32 _signee,
        bytes32 _originHeight
    ) internal pure returns(bytes32) {
            return keccak256(
                abi.encodePacked(
                    _isIOU,
                    _originUniverse, 
                    _originBridge,
                    _originWorld, 
                    _originTokenId,
                    _originOwner,
                    _destinationUniverse, 
                    _destinationBridge, 
                    _destinationWorld, 
                    _destinationTokenId,
                    _destinationOwner,
                    _signee,
                    _originHeight
                )
            );
    }

}