import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { connect } from '../utils/globalContext';
import { State } from '../utils/types';

type Props = State & {
	noPadding?: boolean;
	children: ReactNode;
};

const AuthenticatedRedirect = ({ children, vcInstance }: Props): JSX.Element => {
	return vcInstance ? <Navigate to="/app" replace /> : <>{children}</>;
};

export default connect(AuthenticatedRedirect);
