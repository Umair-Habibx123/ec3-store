import {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext({
    user: null,
    role: null,
    loading: true,
});

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Single source of truth for auth state. Components should consume the
        // context instead of subscribing to onAuthStateChanged individually.
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                try {
                    const snap = await getDoc(doc(db, "users", currentUser.uid));
                    setRole(snap.exists() ? snap.data().role ?? null : null);
                } catch (error) {
                    console.error("Failed to load user role:", error);
                    setRole(null);
                }
            } else {
                setRole(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = useMemo(
        () => ({ user, role, loading }),
        [user, role, loading]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

/** Full auth state: { user, role, loading }. */
export const useAuth = () => useContext(AuthContext);

/**
 * Backward-compatible hook returning just the Firebase user (or null).
 * Existing components rely on this shape.
 */
export const useUser = () => useContext(AuthContext).user;
