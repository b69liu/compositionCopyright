pragma solidity ^0.8.0;


contract CompositionCopyright {
    struct MerKleTree {
        bytes32 root;
        uint64 usedLeafAmount;
        uint64 totalLeafAmount;
    }
    
    mapping( address => MerKleTree ) public collections;

    event Update(address user, bytes4 timestamp,bytes32 newHashedText);

    function initMyCollection() public{
        require(collections[msg.sender].totalLeafAmount==0, "this collection already set up");
        collections[msg.sender].root = bytes32(0xd5b8fa88c09fea4f693b28f86349b919b83fa417f3712b946a29ce30922c69ef);  // hash for 3 layer root hash
        collections[msg.sender].totalLeafAmount = 4;
        collections[msg.sender].usedLeafAmount = 0;
    }

    // helper partially from Daug's voting.sol
    // https://hoytech.github.io/blockchain-storage/lesson2/voting.html
    function leafHash(bytes32 leaf, bytes4 time) private view returns(bytes32) {
        if(bytes32(0x0000000000000000000000000000000000000000000000000000000000005f5f) == leaf){
            // if the leaf is EMPTY, hash as usual
            return keccak256(abi.encodePacked(uint8(0x00), leaf));
        }else{
            // if the leaf is not EMPTY, hash with simplified current time
            bytes4 currentTime;
            if(time!=0){
                currentTime = time;
            } else {
                currentTime = getTime();
            }
            return keccak256(abi.encodePacked(currentTime,uint8(0x00), leaf));
            
        }
    }

    // helper from Daug's voting.sol
    function nodeHash(bytes32 left, bytes32 right) private pure returns(bytes32) {
        return keccak256(abi.encodePacked(uint8(0x01), left, right));
    }
    
    // reused from my voting.sol
    function verify(uint64 path, bytes32[] memory witnesses, address author, bytes32 hashedText, bytes4 time) public view{
        bytes32 reducedHash = leafHash(hashedText, time);
        for(uint i=0; i<witnesses.length; i++){
            // determine left or right
            if (((path >> i) & 1) == 1){
                reducedHash = nodeHash(witnesses[i], reducedHash);
            }else{
                reducedHash = nodeHash(reducedHash, witnesses[i]);
            }
        }
        require(collections[author].root == reducedHash, "hash not match");
    }
    
    // witnesses is used to prove the position is empty
    // need to add time
    function updateLeaf(bytes32[] memory witnesses, bytes32 newHashedText) public {
        address user = msg.sender;
        MerKleTree storage tree = collections[user];
        uint64 usedLeafAmount = tree.usedLeafAmount;
        require(usedLeafAmount < tree.totalLeafAmount, "the tree is full");
        // make sure the leaf is empty
        verify(usedLeafAmount, witnesses, user, 0x0000000000000000000000000000000000000000000000000000000000005f5f, 0);
        bytes32 reducedHash = leafHash(newHashedText, 0);
        // calculate the new root hash
        for(uint i=0; i<witnesses.length; i++){
            // determine left or right
            if (((usedLeafAmount >> i) & 1) == 1){
                reducedHash = nodeHash(witnesses[i], reducedHash);
            }else{
                reducedHash = nodeHash(reducedHash, witnesses[i]);
            }
        }
        // change tree
        tree.root = reducedHash;
        tree.usedLeafAmount = usedLeafAmount + 1;
        emit Update(user, getTime(), newHashedText);
    }

    function getEmptyTreeRootHash(uint leavesAmount) private pure returns(bytes32) {
        // Optimization: hardcoded the 4-layers empty tree root hash
        bytes32 reducedHash = bytes32(0xd5b8fa88c09fea4f693b28f86349b919b83fa417f3712b946a29ce30922c69ef);
        for(uint i=4; i < leavesAmount; i = i << 1){
            reducedHash = nodeHash(reducedHash, reducedHash);
        }
        return reducedHash;
    }


    // append an empty tree with the same size to the old tree
    // height + 1
    // capacity * 2
    function expandTree() public{
        MerKleTree storage tree = collections[msg.sender];
        bytes32 currentRoot = tree.root;
        uint64 totalLeafAmount = tree.totalLeafAmount;
        require(currentRoot != 0, "the tree has not been initialized");
        require(tree.usedLeafAmount == totalLeafAmount, "the tree is not yet full");
        // recalculate the hash
        tree.root = nodeHash(currentRoot, getEmptyTreeRootHash(totalLeafAmount));
        // double total leaves amount
        totalLeafAmount = totalLeafAmount << 1;
        tree.totalLeafAmount = totalLeafAmount;
    }
    
    function getTime() public view returns(bytes4 time){
        bytes memory result =  abi.encodePacked(block.timestamp / 100000);
        assembly {
            time := mload(add(result, 60))
        }
    }

    
}