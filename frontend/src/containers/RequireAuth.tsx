import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { connect } from '../utils/globalContext';
import { State } from '../utils/types';

type Props = State & {
	noPadding?: boolean;
	children: ReactNode;
};

const RequireAuth = ({ children, vcInstance }: Props): JSX.Element => {
	return vcInstance ? <>{children}</> : <Navigate to="/login" replace />;
};

export default connect(RequireAuth);
