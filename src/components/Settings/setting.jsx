import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuth, deleteUser, onAuthStateChanged } from "firebase/auth";
import { doc, deleteDoc, getFirestore } from "firebase/firestore";
import Swal from "sweetalert2";
import { User, MapPin, Trash2 } from "lucide-react";

const SettingsPage = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getFirestore();
  const [currentUser, setCurrentUser] = React.useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Swal.fire("Error", "No user is logged in!", "error");
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [auth, navigate]);

  // Used by the Delete Account button, which is commented out below for now.
  // eslint-disable-next-line no-unused-vars
  const handleDeleteAccount = async () => {
    if (!currentUser) {
      Swal.fire("Error", "No user is logged in!", "error");
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Deleting your account will remove all your order details, account information, and addresses. This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete my account",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: "Deleting your account...",
        text: "Please wait while we delete your account and data.",
        icon: "info",
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      try {
        await deleteDoc(doc(db, "users", currentUser.email));
        await deleteDoc(doc(db, "userCart", currentUser.email));
        await deleteUser(currentUser);

        Swal.fire("Deleted!", "Your account has been successfully deleted.", "success");
        navigate("/");
      } catch (error) {
        console.error("Error deleting account:", error);
        Swal.fire("Error", "Failed to delete your account. Please try again later.", "error");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-gray-50 via-white to-gray-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-6 sm:p-10">
        <h2 className="text-3xl font-bold text-gray-800 mb-8 border-b pb-4">
          Settings
        </h2>

        {/* Personal Information Section */}
        <div>
          <h3 className="text-xl font-semibold text-gray-700 mb-4">
            Personal Information
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/viewProfile"
              className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all duration-200 px-4 py-2 rounded-xl text-sm font-medium"
            >
              <User className="w-4 h-4" />
              View Profile
            </Link>

            <Link
              to="/add-address"
              className="flex items-center gap-2 bg-green-50 text-green-600 hover:bg-green-100 transition-all duration-200 px-4 py-2 rounded-xl text-sm font-medium"
            >
              <MapPin className="w-4 h-4" />
              Add Address
            </Link>
            {/* <button
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200 px-4 py-2 rounded-xl text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
