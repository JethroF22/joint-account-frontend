import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Modal from '../components/Modal';
import QR from '../components/QR';
import { connect } from '../utils/globalContext';
import { useTitle } from '../utils/hooks';
import { State } from '../utils/types';
import { initViteConnect } from '../utils/viteConnect';

type Props = State;

const Landing = ({ i18n, setState, vcInstance }: Props) => {
	const navigate = useNavigate();
	const [connectURI, connectURISet] = useState('');
	useTitle('');
	return (
		<div>
			<div className="bg-skin-base">
				<div className="xy flex-col h-[25rem] max-h-screen">
					<p className="text-4xl font-extrabold">Vite Joint Accounts</p>
					<button
						className="mt-9 font-semibold rounded-lg px-4 py-1 text-xl bg-skin-highlight text-white shadow brightness-button"
						onClick={async () => {
							vcInstance = initViteConnect();
							connectURISet(await vcInstance.createSession());
							vcInstance.on('connect', () => {
								connectURISet('');
								setState({ vcInstance });
								navigate('/app');
							});
						}}
					>
						<p>{i18n.connectWallet}</p>
					</button>
					{!!connectURI && (
						<Modal onClose={() => connectURISet('')}>
							<p className="text-center text-lg mb-3 font-semibold">
								{i18n.scanWithYourViteWalletApp}
							</p>
							<div className="xy">
								<QR data={connectURI} />
							</div>
						</Modal>
					)}
				</div>
			</div>
		</div>
	);
};

export default connect(Landing);
