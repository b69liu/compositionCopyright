const CompositionCopyright = artifacts.require("CompositionCopyright");
const truffleAssert = require('truffle-assertions');
const {
    convertStringToBytes32String,
    getTime,
    getWitnesses
} = require("../offchain.js");



contract("CompositionCopyright", accounts => {
    let myContract;
    const time = getTime();
    const EMPTY = "__";
    let LEAVES = [EMPTY,EMPTY,EMPTY,EMPTY];

    // helper 1
    // loop every leaves can ben slow if the tree is large, so I choose not use for loop
    // rely on LEAVES array
    const verifyNthLeaf = async (nth) =>{
        const nthWitnesses = getWitnesses(LEAVES, nth);
        const nthHashedText = convertStringToBytes32String(LEAVES[nth]);
        await myContract.verify(nth,nthWitnesses,accounts[0],nthHashedText,time);
    }

    // helper 2
    // calculate the witnesses for nth leaf and use them to update the nth leaf
    const updateNthLeaf = async (newText, nth) => {
        const witnesses = getWitnesses(LEAVES, nth);
        const newHashedText = convertStringToBytes32String(newText);
        const result = await myContract.updateLeaf(witnesses, newHashedText);
        // update offchain data
        LEAVES[nth]= newText;
        // check event
        truffleAssert.eventEmitted(result, 'Update', { user: accounts[0], timestamp: time, newHashedText: newHashedText});
    }

    // Hook to run at very beginning
    before(async () => {
        myContract = await CompositionCopyright.deployed();
        // init tree for accounts[0]
        await myContract.initMyCollection();
    });

    // start to test

    it("initMyCollection should revert if already initialized", async () => {
        await truffleAssert.reverts(
            myContract.initMyCollection(),
            "this collection already set up"
        );
    });

    it("getTime should pass", () => {
        return myContract.getTime().then(result => {
            myTime = getTime();
            assert.equal(result, myTime, "getTime not match");
        })
    });

    it("initial tree should have 4 empty leaves", async () => {
        const result = await myContract.collections(accounts[0]);
        const usedLeafAmount = Number(result[1]);
        const totalLeafAmount= Number(result[2]);
        assert.equal(usedLeafAmount, 0, "initial usedLeafAmount not match");
        assert.equal(totalLeafAmount, 4, "initial totalLeafAmount not match");

    });

    it("verify first leaf to be empty", async () => {
        const path = 0;
        const witnesses = getWitnesses(LEAVES, path);
        const hashedText = convertStringToBytes32String(EMPTY);
        await myContract.verify(path,witnesses,accounts[0],hashedText,time );

        // if the value is incorrect, it will revert
        const hashedErrorTest = convertStringToBytes32String("error content");
        await truffleAssert.reverts(
            myContract.verify(path,witnesses,accounts[0],hashedErrorTest,time ),
            "hash not match"
        );
    });

    it("update the first leaf should work", async () => {
        const newText = "hello world";
        const nth = 0;
        await updateNthLeaf(newText, nth);

        await verifyNthLeaf(0);
        await verifyNthLeaf(1);
    });

    it("verifying leaf with wrong time should revert", async () => {
        const path = 0;
        const witnesses = getWitnesses(LEAVES, path);
        const hashedText = convertStringToBytes32String(LEAVES[path]);
        // with correct time it should pass
        await myContract.verify(path,witnesses,accounts[0],hashedText,time);
        // with wrong time it should revert
        const wrongTime = "0x00003f96";
        await truffleAssert.reverts(
            myContract.verify(path,witnesses,accounts[0],hashedText,wrongTime),
            "hash not match"
        );
    });

    it("update the second leaf should work", async () => {
        const newText = "high there";
        const nth = 1;
        await updateNthLeaf(newText, nth);

        // verify all leaves
        await verifyNthLeaf(0);
        await verifyNthLeaf(1);
        await verifyNthLeaf(2);
        await verifyNthLeaf(3);

    });

    it("expandTree should revert if not full", async () => {
        await truffleAssert.reverts(
            myContract.expandTree(),
            "the tree is not yet full"
        );
    });

    it("update the third and fourth leaf should work", async () => {
        const thirdText = "here we go";
        const fourthText = "I am fourth leaf";
        await updateNthLeaf(thirdText, 2);
        await updateNthLeaf(fourthText, 3);

        await verifyNthLeaf(2);
        await verifyNthLeaf(3);
    });

    it("updateLeaf should revert if the tree is full", async () => {
        const randomWitnesses = ['0xb5e318828670986b73a21c70e9919c0865d25ce81760a6911e44746d51ef3987'];
        const randomHashedText = "0x0000000000000000000000000000000000000000000000007768617465766572"
        await truffleAssert.reverts(
            myContract.updateLeaf(randomWitnesses, randomHashedText),
            "the tree is full"
        );
    });
    
    it("now it should have 4 updated leaves", async () => {
        const result = await myContract.collections(accounts[0]);
        const usedLeafAmount = Number(result[1]);
        const totalLeafAmount= Number(result[2]);
        assert.equal(usedLeafAmount, 4, "usedLeafAmount not match");
        assert.equal(totalLeafAmount, 4, "totalLeafAmount not match");

    });

    it("expandTree should work", async () => {
        await myContract.expandTree();
        const result = await myContract.collections(accounts[0]);
        const usedLeafAmount = parseInt(result[1]);
        const totalLeafAmount= parseInt(result[2]);
        assert.equal(usedLeafAmount, 4, "usedLeafAmount not match");
        assert.equal(totalLeafAmount, 8, "totalLeafAmount not match");
        // update offchain storage
        LEAVES = [...LEAVES, ...Array(LEAVES.length).fill(EMPTY)];
        
        // test boundary leaves
        await verifyNthLeaf(0);
        await verifyNthLeaf(3);
        await verifyNthLeaf(4);
        await verifyNthLeaf(7);
    });
    
    it("expand second time should work", async () => {
        const text = "whatever";
        // fill the rest leaves
        for(let i = 4; i < LEAVES.length; ++i){
            await updateNthLeaf(text, i);
        }

        // expand tree on chain
        await myContract.expandTree();
        const result = await myContract.collections(accounts[0]);
        const usedLeafAmount = parseInt(result[1]);
        const totalLeafAmount= parseInt(result[2]);
        assert.equal(usedLeafAmount, 8, "usedLeafAmount not match");
        assert.equal(totalLeafAmount, 16, "totalLeafAmount not match");
        // update offchain storage
        LEAVES = [...LEAVES, ...Array(LEAVES.length).fill(EMPTY)];
        
        await verifyNthLeaf(7);
        await verifyNthLeaf(15);
    });

    it("expandTree should revert if the user's collect has not been initialized", async () => {
        await truffleAssert.reverts(
            myContract.expandTree({from:accounts[1]}),
            "the tree has not been initialized"
        );
    });


});