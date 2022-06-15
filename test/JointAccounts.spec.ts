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
		await jointAccountsViewsContract.call(
			'setJointAccountContractAddress',
			[jointAccountsContract.address],
			{ caller: deployer }
		);

		// expect(await jointAccountsContract.query('viewsContractAddress')).to.be.deep.equal([
		// 	jointAccountsViewsContract.address,
		// ]);
		expect(await jointAccountsViewsContract.query('accountsContractAddress')).to.be.deep.equal([
			jointAccountsContract.address,
		]);
	});

	describe('account creation', function () {
		it('creates an account', async function () {
			await jointAccountsContract.call('createAccount', [[alice.address, bob.address], 1, 1, 0], {
				caller: alice,
			});
			await sleep(5000);
			expect(await jointAccountsViewsContract.query('accountExists', [0])).to.be.deep.equal(['1']);
			expect(await jointAccountsViewsContract.query('isStatic', [0])).to.be.deep.equal(['1']);
			expect(await jointAccountsViewsContract.query('isMemberOnlyDeposit', [0])).to.be.deep.equal([
				'0',
			]);
			expect(
				await jointAccountsViewsContract.query('getNumUserAccounts', [alice.address])
			).to.be.deep.equal(['1']);
			expect(
				await jointAccountsViewsContract.query('getNumUserAccounts', [bob.address])
			).to.be.deep.equal(['1']);
			expect(await jointAccountsViewsContract.query('getMembers', [0])).to.be.deep.equal([
				[alice.address, bob.address],
			]);
			expect(await jointAccountsViewsContract.query('approvalThreshold', [0])).to.be.deep.equal([
				'1',
			]);

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
			]);
		});
	});
});
