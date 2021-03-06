// NOTE: Queries are authomatically retried and don't fail (while calls do), so some query tests have been written as call tests.

import { describe } from 'mocha';
import chai from 'chai';
const vite = require('@vite/vuilder');
import chaiAsPromised from 'chai-as-promised';
import config from './vite.config.json';
const {
	accountBlock: { createAccountBlock, ReceiveAccountBlockTask },
} = require('@vite/vitejs');

chai.use(chaiAsPromised);
const expect = chai.expect;

let provider: any;
let deployer: any;
let alice: any;
let bob: any;
let charlie: any;
let jointAccountsContract: any;
let jointAccountsViewsContract: any;
let mnemonicCounter = 1;

const viteFullId = '000000000000000000000000000000000000000000005649544520544f4b454e';

const NULL = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const NULL_ADDRESS = 'vite_0000000000000000000000000000000000000000a4f3a0cb58';
const NULL_TOKEN = 'tti_000000000000000000004cfd';

const toFull = (id: string) => {
	const replacedId = id.replace('tti_', '00000000000000000000000000000000000000000000');
	return replacedId.substring(0, replacedId.length - 4);
};

let testTokenId: any;
const testFullId = () => toFull(testTokenId);

const waitForContractReceive = async (tokenId: string) => {
	do {} while ((await jointAccountsContract.balance(tokenId)) == '0');
};

const checkEvents = (result: any, correct: Array<Object>) => {
	expect(result).to.be.an('array').with.length(correct.length);
	for (let i = 0; i < correct.length; i++) {
		expect(result[i].returnValues).to.be.deep.equal(correct[i]);
	}
};

async function receiveIssuedTokens() {
	const blockTask = new ReceiveAccountBlockTask({
		address: deployer.address,
		privateKey: deployer.privateKey,
		provider,
	});
	let resolveFunction: any;
	const promiseFunction = (resolve: any) => {
		resolveFunction = resolve;
	};
	blockTask.onSuccess((data: any) => {
		resolveFunction(data);
	});

	blockTask.start();
	return new Promise(promiseFunction);
}

const sleep = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));

describe('test JointAccounts', function () {
	before(async function () {
		provider = vite.newProvider(config.networks.local.http);
		deployer = vite.newAccount(config.networks.local.mnemonic, 0, provider);

		const block = createAccountBlock('issueToken', {
			address: deployer.address,
			tokenName: 'Test Token',
			isReIssuable: true,
			maxSupply: 100000000,
			totalSupply: 100000000,
			isOwnerBurnOnly: false,
			decimals: 2,
			tokenSymbol: 'TEST',
			provider,
			privateKey: deployer.privateKey,
		});

		block.setProvider(provider);
		block.setPrivateKey(deployer.privateKey);
		await block.autoSend();

		await deployer.receiveAll();
		await receiveIssuedTokens();

		//console.log(tokenResult);
		const tokenInfoList = (await provider.request('contract_getTokenInfoList', 0, 1000))
			.tokenInfoList;
		testTokenId = tokenInfoList.find(
			(e: any) => e.tokenId !== viteFullId && e.owner === deployer.address
		).tokenId;
		//testTokenId = tokenInfo.tokenId;
	});
	beforeEach(async function () {
		// init users
		alice = vite.newAccount(config.networks.local.mnemonic, mnemonicCounter++, provider);
		bob = vite.newAccount(config.networks.local.mnemonic, mnemonicCounter++, provider);
		charlie = vite.newAccount(config.networks.local.mnemonic, mnemonicCounter++, provider);
		await deployer.sendToken(alice.address, '0');
		await alice.receiveAll();
		await deployer.sendToken(bob.address, '0');
		await bob.receiveAll();
		await deployer.sendToken(charlie.address, '0');
		await charlie.receiveAll();

		// compile
		const compiledJointAccountsContract = await vite.compile('JointAccounts.solpp');
		const compiledJointAccountsViewsContract = await vite.compile('JointAccountsViews.solpp');
		expect(compiledJointAccountsContract).to.have.property('JointAccounts');
		expect(compiledJointAccountsViewsContract).to.have.property('JointAccountsViews');
		jointAccountsContract = compiledJointAccountsContract.JointAccounts;
		jointAccountsViewsContract = compiledJointAccountsViewsContract.JointAccountsViews;
		// deploy
		jointAccountsContract.setDeployer(deployer).setProvider(provider);
		jointAccountsViewsContract.setDeployer(deployer).setProvider(provider);
		await jointAccountsContract.deploy({ responseLatency: 1 });
		await jointAccountsViewsContract.deploy({ responseLatency: 1 });
		expect(jointAccountsContract.address).to.be.a('string');
		expect(jointAccountsViewsContract.address).to.be.a('string');

		await jointAccountsContract.call(
			'setJointAccountViewsContractAddress',
			[jointAccountsViewsContract.address],
			{ caller: deployer }
		);
	});

	// describe('account creation', function () {
	// 	it('creates an account', async function () {
	// 		await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 1, 1, 0], {
	// 			caller: alice,
	// 		});
	// 		await sleep(5000);
	// 		expect(await jointAccountsViewsContract.query('accountExists', [0])).to.be.deep.equal(['1']);
	// 		expect(await jointAccountsViewsContract.query('isStatic', [0])).to.be.deep.equal(['1']);
	// 		expect(await jointAccountsViewsContract.query('isMemberOnlyDeposit', [0])).to.be.deep.equal([
	// 			'0',
	// 		]);
	// 		expect(
	// 			await jointAccountsViewsContract.query('getNumUserAccounts', [alice.address])
	// 		).to.be.deep.equal(['1']);
	// 		expect(
	// 			await jointAccountsViewsContract.query('getNumUserAccounts', [bob.address])
	// 		).to.be.deep.equal(['1']);
	// 		expect(await jointAccountsViewsContract.query('getMembers', [0])).to.be.deep.equal([
	// 			[alice.address, bob.address],
	// 		]);
	// 		expect(await jointAccountsViewsContract.query('approvalThreshold', [0])).to.be.deep.equal([
	// 			'1',
	// 		]);

	// 		const events = await jointAccountsContract.getPastEvents('allEvents', {
	// 			fromHeight: 0,
	// 			toHeight: 100,
	// 		});
	// 		checkEvents(events, [
	// 			{
	// 				'0': '0',
	// 				accountId: '0',
	// 				'1': alice.address,
	// 				creator: alice.address,
	// 			}, // Account created
	// 		]);
	// 	});

	// 	it('creates an account with as many members as required votes', async function () {
	// 		await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
	// 			caller: alice,
	// 		});
	// 		await sleep(5000);

	// 		expect(await jointAccountsViewsContract.query('accountExists', [0])).to.be.deep.equal(['1']);
	// 		expect(await jointAccountsViewsContract.query('isStatic', [0])).to.be.deep.equal(['1']);
	// 		expect(await jointAccountsViewsContract.query('isMemberOnlyDeposit', [0])).to.be.deep.equal([
	// 			'0',
	// 		]);
	// 		expect(await jointAccountsViewsContract.query('getMembers', [0])).to.be.deep.equal([
	// 			[alice.address, bob.address],
	// 		]);
	// 		expect(await jointAccountsViewsContract.query('approvalThreshold', [0])).to.be.deep.equal([
	// 			'2',
	// 		]);

	// 		const events = await jointAccountsContract.getPastEvents('allEvents', {
	// 			fromHeight: 0,
	// 			toHeight: 100,
	// 		});
	// 		checkEvents(events, [
	// 			{
	// 				'0': '0',
	// 				accountId: '0',
	// 				'1': alice.address,
	// 				creator: alice.address,
	// 			}, // Account created
	// 		]);
	// 	});

	// 	it('creates two accounts', async function () {
	// 		await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 1, 1, 0], {
	// 			caller: alice,
	// 		});
	// 		await jointAccountsContract.call(
	// 			'createAccount',
	// 			[[alice.address, charlie.address], 1, 1, 0],
	// 			{
	// 				caller: alice,
	// 			}
	// 		);
	// 		await sleep(5000);

	// 		expect(await jointAccountsViewsContract.query('accountExists', [0])).to.be.deep.equal(['1']);
	// 		expect(await jointAccountsViewsContract.query('accountExists', [1])).to.be.deep.equal(['1']);
	// 		expect(await jointAccountsViewsContract.query('accountExists', [2])).to.be.deep.equal(['0']);

	// 		const events = await jointAccountsContract.getPastEvents('allEvents', {
	// 			fromHeight: 0,
	// 			toHeight: 100,
	// 		});
	// 		checkEvents(events, [
	// 			{
	// 				'0': '0',
	// 				accountId: '0',
	// 				'1': alice.address,
	// 				creator: alice.address,
	// 			}, // Account created
	// 			{
	// 				'0': '1',
	// 				accountId: '1',
	// 				'1': alice.address,
	// 				creator: alice.address,
	// 			}, // Account created
	// 		]);
	// 	});
	// });

	// describe('deposit', function () {
	// 	it('deposits to an account', async function () {
	// 		await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
	// 			caller: alice,
	// 		});

	// 		await deployer.sendToken(alice.address, '1000000', testTokenId);
	// 		await alice.receiveAll();
	// 		await jointAccountsContract.call('deposit', [0], {
	// 			caller: alice,
	// 			amount: '1000000',
	// 			tokenId: testTokenId,
	// 		});
	// 		await waitForContractReceive(testTokenId);

	// 		await sleep(5000);

	// 		expect(
	// 			await jointAccountsViewsContract.query('balanceOf', [0, testTokenId])
	// 		).to.be.deep.equal(['1000000']);

	// 		const events = await jointAccountsContract.getPastEvents('allEvents', {
	// 			fromHeight: 0,
	// 			toHeight: 100,
	// 		});
	// 		checkEvents(events, [
	// 			{
	// 				'0': '0',
	// 				accountId: '0',
	// 				'1': alice.address,
	// 				creator: alice.address,
	// 			}, // Account created
	// 			{
	// 				'0': '0',
	// 				accountId: '0',
	// 				'1': testTokenId,
	// 				tokenId: testTokenId,
	// 				'2': alice.address,
	// 				from: alice.address,
	// 				'3': '1000000',
	// 				amount: '1000000',
	// 			}, // Alice deposits
	// 		]);
	// 	});

	// 	it('deposits as a non-member to a regular account', async function () {
	// 		await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
	// 			caller: alice,
	// 		});

	// 		await deployer.sendToken(charlie.address, '1000000', testTokenId);
	// 		await charlie.receiveAll();
	// 		await jointAccountsContract.call('deposit', [0], {
	// 			caller: charlie,
	// 			amount: '1000000',
	// 			tokenId: testTokenId,
	// 		});
	// 		await waitForContractReceive(testTokenId);

	// 		await sleep(5000);

	// 		expect(
	// 			await jointAccountsViewsContract.query('balanceOf', [0, testTokenId])
	// 		).to.be.deep.equal(['1000000']);

	// 		const events = await jointAccountsContract.getPastEvents('allEvents', {
	// 			fromHeight: 0,
	// 			toHeight: 100,
	// 		});
	// 		checkEvents(events, [
	// 			{
	// 				'0': '0',
	// 				accountId: '0',
	// 				'1': alice.address,
	// 				creator: alice.address,
	// 			}, // Account created
	// 			{
	// 				'0': '0',
	// 				accountId: '0',
	// 				'1': testTokenId,
	// 				tokenId: testTokenId,
	// 				'2': charlie.address,
	// 				from: charlie.address,
	// 				'3': '1000000',
	// 				amount: '1000000',
	// 			}, // Charlie deposits
	// 		]);
	// 	});

	// 	// it('fails to deposit to a non-existent account', async function () {
	// 	// 	await deployer.sendToken(alice.address, '1000000', testTokenId);
	// 	// 	await alice.receiveAll();

	// 	// 	expect(
	// 	// 		jointAccountsContract.call('deposit', [0], {
	// 	// 			caller: alice,
	// 	// 			amount: '1000000',
	// 	// 			tokenId: testTokenId,
	// 	// 		})
	// 	// 	).to.be.eventually.rejectedWith('revert');
	// 	// });

	// 	// it('fails to deposit as a non-member to a member-only deposit account', async function () {
	// 	// 	await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 1], {
	// 	// 		caller: alice,
	// 	// 	});

	// 	// 	await deployer.sendToken(charlie.address, '1000000', testTokenId);
	// 	// 	await charlie.receiveAll();

	// 	// 	expect(
	// 	// 		jointAccountsContract.call('deposit', [0], {
	// 	// 			caller: charlie,
	// 	// 			amount: '1000000',
	// 	// 			tokenId: testTokenId,
	// 	// 		})
	// 	// 	).to.be.eventually.rejectedWith('revert');
	// 	// });
	// });
	describe('transfer motion', function () {
		it('creates and votes a transfer motion', async function () {
			await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
				caller: alice,
			});

			await deployer.sendToken(alice.address, '1000000', testTokenId);
			await alice.receiveAll();
			await jointAccountsContract.call('deposit', [0], {
				caller: alice,
				amount: '1000000',
				tokenId: testTokenId,
			});
			await waitForContractReceive(testTokenId);

			await jointAccountsContract.call(
				'createTransferMotion',
				[0, testTokenId, '50', charlie.address, NULL],
				{
					caller: alice,
				}
			);
			await charlie.receiveAll();

			await sleep(5000);

			expect(await jointAccountsViewsContract.query('approvalThreshold', [0])).to.be.deep.equal([
				'2',
			]);
			expect(await jointAccountsViewsContract.query('motionExists', [0, 0])).to.be.deep.equal([
				'1',
			]);
			expect(await jointAccountsViewsContract.query('motionType', [0, 0])).to.be.deep.equal(['0']);
			expect(await jointAccountsViewsContract.query('tokenId', [0, 0])).to.be.deep.equal([
				testTokenId,
			]);
			expect(await jointAccountsViewsContract.query('transferAmount', [0, 0])).to.be.deep.equal([
				'50',
			]);
			expect(await jointAccountsViewsContract.query('to', [0, 0])).to.be.deep.equal([
				charlie.address,
			]);
			expect(await jointAccountsViewsContract.query('threshold', [0, 0])).to.be.deep.equal([NULL]);
			expect(await jointAccountsViewsContract.query('proposer', [0, 0])).to.be.deep.equal([
				alice.address,
			]);
			expect(await jointAccountsViewsContract.query('voteCount', [0, 0])).to.be.deep.equal(['1']);
			expect(await jointAccountsViewsContract.query('active', [0, 0])).to.be.deep.equal(['1']);

			expect(
				await jointAccountsViewsContract.query('voted', [0, 0, alice.address])
			).to.be.deep.equal(['1']);
			expect(await jointAccountsViewsContract.query('voted', [0, 0, bob.address])).to.be.deep.equal(
				['0']
			);

			// Motion hasn't been approved yet
			expect(await charlie.balance(testTokenId)).to.be.deep.equal('0');

			await jointAccountsContract.call('voteMotion', [0, '0'], { caller: bob });
			await charlie.receiveAll();

			await sleep(5000);

			expect(await jointAccountsViewsContract.query('voteCount', [0, 0])).to.be.deep.equal(['2']);
			expect(await jointAccountsViewsContract.query('active', [0, 0])).to.be.deep.equal(['0']);

			expect(
				await jointAccountsViewsContract.query('voted', [0, 0, alice.address])
			).to.be.deep.equal(['1']);
			expect(await jointAccountsViewsContract.query('voted', [0, 0, bob.address])).to.be.deep.equal(
				['1']
			);

			// Motion was approved
			expect(await charlie.balance(testTokenId)).to.be.deep.equal('50');

			const events = await jointAccountsContract.getPastEvents('allEvents', {
				fromHeight: 0,
				toHeight: 100,
			});
			checkEvents(events, [
				{
					'0': '0',
					accountId: '0',
					'1': alice.address,
					creator: alice.address,
				}, // Account created
				{
					'0': '0',
					accountId: '0',
					'1': testTokenId,
					tokenId: testTokenId,
					'2': alice.address,
					from: alice.address,
					'3': '1000000',
					amount: '1000000',
				}, // Alice deposits
				{
					'0': '0',
					accountId: '0',
					'1': '0',
					motionId: '0',
					'2': '0',
					motionType: '0',
					'3': alice.address,
					proposer: alice.address,
					'4': testTokenId,
					tokenId: testTokenId,
					'5': '50',
					transferAmount: '50',
					'6': charlie.address,
					to: charlie.address,
					'7': NULL,
					destinationAccount: NULL,
					'8': NULL,
					threshold: NULL,
				}, // Motion created
				{
					'0': '0',
					accountId: '0',
					'1': '0',
					motionId: '0',
					'2': alice.address,
					voter: alice.address,
					'3': '1',
					vote: '1',
				}, // Alice votes yes
				{
					'0': '0',
					accountId: '0',
					'1': '0',
					motionId: '0',
					'2': bob.address,
					voter: bob.address,
					'3': '1',
					vote: '1',
				}, // Bob votes yes
				{
					'0': '0',
					accountId: '0',
					'1': '0',
					motionId: '0',
					'2': testTokenId,
					tokenId: testTokenId,
					'3': charlie.address,
					to: charlie.address,
					'4': NULL,
					destinationAccount: NULL,
					'5': '50',
					amount: '50',
				}, // Transfer is executed
			]);
		});

		it('creates and immediately approves a transfer motion', async function () {
			await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 1, 1, 0], {
				caller: alice,
			});

			await deployer.sendToken(alice.address, '1000000', testTokenId);
			await alice.receiveAll();
			await jointAccountsContract.call('deposit', [0], {
				caller: alice,
				amount: '1000000',
				tokenId: testTokenId,
			});
			await waitForContractReceive(testTokenId);

			await jointAccountsContract.call(
				'createTransferMotion',
				[0, testTokenId, '50', charlie.address, NULL],
				{
					caller: alice,
				}
			);
			await charlie.receiveAll();

			// Motion was approved
			expect(await charlie.balance(testTokenId)).to.be.deep.equal('50');

			const events = await jointAccountsContract.getPastEvents('allEvents', {
				fromHeight: 0,
				toHeight: 100,
			});
			checkEvents(events, [
				{
					'0': '0',
					accountId: '0',
					'1': alice.address,
					creator: alice.address,
				}, // Account created
				{
					'0': '0',
					accountId: '0',
					'1': testTokenId,
					tokenId: testTokenId,
					'2': alice.address,
					from: alice.address,
					'3': '1000000',
					amount: '1000000',
				}, // Alice deposits
				{
					'0': '0',
					accountId: '0',
					'1': '0',
					motionId: '0',
					'2': '0',
					motionType: '0',
					'3': alice.address,
					proposer: alice.address,
					'4': testTokenId,
					tokenId: testTokenId,
					'5': '50',
					transferAmount: '50',
					'6': charlie.address,
					to: charlie.address,
					'7': NULL,
					destinationAccount: NULL,
					'8': NULL,
					threshold: NULL,
				}, // Motion created
				{
					'0': '0',
					accountId: '0',
					'1': '0',
					motionId: '0',
					'2': alice.address,
					voter: alice.address,
					'3': '1',
					vote: '1',
				}, // Alice votes yes
				{
					'0': '0',
					accountId: '0',
					'1': '0',
					motionId: '0',
					'2': testTokenId,
					tokenId: testTokenId,
					'3': charlie.address,
					to: charlie.address,
					'4': NULL,
					destinationAccount: NULL,
					'5': '50',
					amount: '50',
				}, // Transfer is executed
			]);
		});

		it('fails to create a transfer motion without enough funds', async function () {
			await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
				caller: alice,
			});

			await deployer.sendToken(alice.address, '1000000', testTokenId);
			await alice.receiveAll();
			await jointAccountsContract.call('deposit', [0], {
				caller: alice,
				amount: '1000000',
				tokenId: testTokenId,
			});
			await waitForContractReceive(testTokenId);

			expect(
				jointAccountsContract.call(
					'createTransferMotion',
					[0, testTokenId, '1000001', charlie.address, NULL],
					{
						caller: alice,
					}
				)
			).to.eventually.be.rejectedWith('revert');
		});

		it('fails to execute a transfer motion due to not having enough funds', async function () {
			await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
				caller: alice,
			});

			await deployer.sendToken(alice.address, '1000000', testTokenId);
			await alice.receiveAll();
			await jointAccountsContract.call('deposit', [0], {
				caller: alice,
				amount: '1000000',
				tokenId: testTokenId,
			});
			await waitForContractReceive(testTokenId);

			// First motion. Since there are enough funds, it can be created
			await jointAccountsContract.call(
				'createTransferMotion',
				[0, testTokenId, '1000000', charlie.address, NULL],
				{ caller: alice }
			);

			// Second motion. Again this one can be created
			await jointAccountsContract.call(
				'createTransferMotion',
				[0, testTokenId, '1000000', charlie.address, NULL],
				{ caller: alice }
			);

			await sleep(5000);

			// First motion is approved, contract balance is now 0
			await jointAccountsContract.call('voteMotion', [0, '0'], { caller: bob });
			await charlie.receiveAll();
			expect(await jointAccountsContract.balance(testTokenId)).to.be.deep.equal('0');
			expect(await jointAccountsViewsContract.balance(testTokenId)).to.be.deep.equal('0');

			expect(await jointAccountsViewsContract.query('voteCount', [0, 1])).to.be.deep.equal(['1']);

			// Second motion is voted, fails
			expect(
				jointAccountsContract.call('voteMotion', [0, 1], { caller: bob })
			).to.eventually.be.rejectedWith('revert');
		});

		it('fails to create a transfer motion to both an external and an internal account', async function () {
			await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
				caller: alice,
			});
			await jointAccountsContract.call(
				'createAccount',
				[[alice.address, charlie.address], 2, 1, 0],
				{
					caller: alice,
				}
			);

			await deployer.sendToken(alice.address, '1000000', testTokenId);
			await alice.receiveAll();
			await jointAccountsContract.call('deposit', [0], {
				caller: alice,
				amount: '1000000',
				tokenId: testTokenId,
			});
			await waitForContractReceive(testTokenId);

			expect(
				jointAccountsContract.call(
					'createTransferMotion',
					[0, testTokenId, '50', charlie.address, '1'],
					{
						caller: alice,
					}
				)
			).to.be.eventually.rejectedWith('revert');
		});

		it('fails to create a transfer motion to neither an external nor an internal account', async function () {
			await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 2, 1, 0], {
				caller: alice,
			});
			await jointAccountsContract.call(
				'createAccount',
				[[alice.address, charlie.address], 2, 1, 0],
				{
					caller: alice,
				}
			);

			await deployer.sendToken(alice.address, '1000000', testTokenId);
			await alice.receiveAll();
			await jointAccountsContract.call('deposit', [0], {
				caller: alice,
				amount: '1000000',
				tokenId: testTokenId,
			});
			await waitForContractReceive(testTokenId);

			expect(
				jointAccountsContract.call(
					'createTransferMotion',
					[0, testTokenId, '50', NULL_ADDRESS, NULL],
					{
						caller: alice,
					}
				)
			).to.be.eventually.rejectedWith('revert');
		});
	});
});
