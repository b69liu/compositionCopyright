const ethers = require('ethers');

const EMPTY_STRING = "__";


function convertStringToBytes32String(str){
    const byteLikeArray =  Array.from(str, x=> x.charCodeAt(0));
    return ethers.utils.hexZeroPad(ethers.utils.hexlify(byteLikeArray), 32);
}

// from daug's voter-tree.js
// https://hoytech.github.io/blockchain-storage/lesson2/voting.html
function leafHash(leaf) {
    if("0x0000000000000000000000000000000000000000000000000000000000005f5f"===leaf){
        return ethers.utils.keccak256(ethers.utils.concat(['0x00', leaf]));
    }else{
        return ethers.utils.keccak256(ethers.utils.concat([getTime(),'0x00', leaf]));
    }
}
// from daug's voter-tree.js
function nodeHash(left, right) {
    return ethers.utils.keccak256(ethers.utils.concat(['0x01', left, right]));
}
// from daug's voter-tree.js
function hashLevel(level) {
    let nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
        if (i === level.length - 1) nextLevel.push(level[i]); // odd number of nodes at this level
        else nextLevel.push(nodeHash(level[i], level[i+1]));
    }
    return nextLevel;
}
// from daug's voter-tree.js
function merkleRoot(items) {
    if (items.length === 0) throw("can't build merkle tree with empty items");

    let level = items.map(leafHash);

    while (level.length > 1) {
        level = hashLevel(level);
    }

    return level[0];
}




function checkLength(length){
    if(length < 1){
        throw new Error("cannot init tree with 0 leaf");
    }
    // the tree has to be complete(has 2^n leaves)
    let lengthTemp = length;
    while(lengthTemp > 1){
        if(lengthTemp & 1 == 1){
            throw new Error("cannot init incomplete tree");
        }
        lengthTemp = lengthTemp >> 1;
    }
    return true;
}

function initEmptyTree(length){
    length = parseInt(length);
    checkLength(length);
    console.log("valid length");
    // generate an array of leaves containing EMPTY_STRING as bytes(array of ascii)
    const leavesArray = Array(length).fill(EMPTY_STRING).map(x=> convertStringToBytes32String(x));
    return merkleRoot(leavesArray);
}


function calculateAllEmptyTreeRoots(maxLength){
    let emptyTreeHashMapArray = [];
    let currentHash = initEmptyTree(1);
    emptyTreeHashMapArray.push(currentHash);
    for(let i=1; i < maxLength; ++i){
        currentHash = nodeHash(currentHash, currentHash);
        emptyTreeHashMapArray.push(currentHash);
    }
    return emptyTreeHashMapArray;
}


// from daug's voter-tree.js
function merkleProof(items, index) {
    let path = [];
    let witnesses = [];
    let level = items.map(leafHash);
    while (level.length > 1) {
        // Get proof for this level
        let nextIndex = Math.floor(index / 2);
        if (nextIndex * 2 === index) { // left side
            if (index < level.length - 1) { // only if we're not the last in a level with odd number of nodes
                path.push(0);
                witnesses.push(level[index + 1]);
            }
        } else { // right side
            path.push(1);
            witnesses.push(level[index - 1]);
        }
        index = nextIndex;
        level = hashLevel(level);
    }
    return {
        path: path.reduceRight((a,b) => (a << 1) | b, 0),
        witnesses,
    };
}

function printWitnesses(){
    let proof = merkleProof( 
        ['hello world','__','__','__'].map(x=> convertStringToBytes32String(x)),
        1
    )

    console.log('path: ' + proof.path);
    console.log('witnesses: ' + JSON.stringify(proof.witnesses));
}

// get the simplifiedTime, about the same day
function getTime(theDate){
    const milisecond =  theDate? theDate : new Date();
    const simplifiedTime =  Math.floor(milisecond/100000000);
    return ethers.utils.hexZeroPad(ethers.utils.hexlify(simplifiedTime), 4);
}

function getWitnesses(array, path){
    let proof = merkleProof( 
        array.map(x=> convertStringToBytes32String(x)),
        path
    );
    return proof.witnesses;
}

// console.log(calculateAllEmptyTreeRoots(3));
// console.log("4 empty:",initEmptyTree(4));
// printWitnesses();

// console.log(leafHash("0x00000000000000000000000000000000000000000068656c6c6f20776f726c64"));


// console.log(
//     ['__','__','__','__'].map(x=> convertStringToBytes32String(x)).map(x => ethers.utils.hexZeroPad(ethers.utils.hexlify(x), 32))
// )
// console.log(
//     convertStringToBytes32String("hi there")
// )

module.exports= {
    convertStringToBytes32String,
    leafHash,
    nodeHash,
    merkleRoot,
    merkleProof,
    getTime,
    getWitnesses
}
