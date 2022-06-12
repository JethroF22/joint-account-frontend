import { LogoutIcon } from '@heroicons/react/outline';
import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import DropdownButton from '../components/DropdownButton';
import { connect } from '../utils/globalContext';
import { shortenAddress } from '../utils/strings';
import { State } from '../utils/types';

type Props = State & {
	children: ReactNode;
	className?: string;
};

const ViteConnectButton = ({ setState, i18n, vcInstance }: Props) => {
	const navigate = useNavigate();
	useEffect(() => {
		if (vcInstance) {
			vcInstance.on('disconnect', () => setState({ vcInstance: null }));
		}
	}, [setState, vcInstance]);

	const logOut = () => {
		vcInstance!.killSession();
		navigate('/');
	};

	return (
		<DropdownButton
			buttonJsx={<p>{shortenAddress(vcInstance!.accounts[0])}</p>}
			dropdownJsx={
				<div className="fx px-2 py-0.5 h-7 gap-2">
					<LogoutIcon className="h-full text-skin-muted" />
					<button
						className="font-semibold"
						onClick={logOut}
						onMouseDown={(e) => e.preventDefault()}
					>
						{i18n.logOut}
					</button>
				</div>
			}
		/>
	);
};

export default connect(ViteConnectButton);
