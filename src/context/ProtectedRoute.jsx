import { useAuth } from "./UserContext";
import Forbidden from "../components/AdminDashboard/Forbidden";
import LoadingSpinner from "../utils/LoadingSpinner";

const ProtectedRoute = ({ children, requiredRole }) => {
    const { user, role, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner size="xl" />;
    }

    if (!user || (requiredRole && role !== requiredRole)) {
        return <Forbidden />;
    }

    return children;
};

export default ProtectedRoute;
