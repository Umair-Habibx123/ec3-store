import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
    Package,
    Clock,
    CheckCircle,
    Truck,
    Home,
    CreditCard,
    Wallet,
    XCircle,
    Loader2,
    ChevronRight,
    ShoppingBag
} from "lucide-react";

const statusIcons = {
    pending: <Clock className="text-amber-500" size={18} />,
    confirmed: <CheckCircle className="text-blue-500" size={18} />,
    shipped: <Truck className="text-indigo-500" size={18} />,
    delivered: <Home className="text-green-500" size={18} />,
    cancelled: <XCircle className="text-red-500" size={18} />
};

const paymentIcons = {
    cash: <Wallet className="text-gray-600" size={18} />,
    card: <CreditCard className="text-gray-600" size={18} />
};

const statusColors = {
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    confirmed: "bg-blue-50 text-blue-800 border-blue-200",
    shipped: "bg-indigo-50 text-indigo-800 border-indigo-200",
    delivered: "bg-green-50 text-green-800 border-green-200",
    cancelled: "bg-red-50 text-red-800 border-red-200"
};

const paymentStatusColors = {
    paid: "bg-green-50 text-green-800 border-green-200",
    unpaid: "bg-amber-50 text-amber-800 border-amber-200",
    failed: "bg-red-50 text-red-800 border-red-200"
};

const MyOrdersPage = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                console.error("No user is signed in");
                navigate("/");
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    useEffect(() => {
        if (!userId) return;

        const fetchOrders = async () => {
            try {
                setLoading(true);
                const ordersRef = collection(db, "orders");
                const q = query(ordersRef, where("userId", "==", userId));
                const querySnapshot = await getDocs(q);
                const ordersData = [];

                querySnapshot.forEach((doc) => {
                    const orderData = doc.data();
                    ordersData.push({
                        id: doc.id,
                        ...orderData,
                        createdAt: orderData.createdAt?.toLocaleString() || "N/A"
                    });
                });

                ordersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setOrders(ordersData);
            } catch (error) {
                console.error("Error fetching orders: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [userId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                    <Loader2 className="animate-spin w-12 h-12 text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Loading your orders...</p>
                </div>
            </div>
        );
    }

    if (!orders.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-sm overflow-hidden p-8 text-center border border-gray-100">
                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShoppingBag className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">No Orders Yet</h2>
                    <p className="text-gray-600 mb-6">You haven't placed any orders yet. Start shopping to see your orders here.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
                    >
                        Browse Products
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10 text-center sm:text-left">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center sm:justify-start gap-3">
                        <ShoppingBag className="text-blue-600" size={28} />
                        Your Orders
                    </h1>
                    <p className="text-gray-600 max-w-2xl">Track and manage all your recent purchases</p>
                </div>

                <div className="space-y-5">
                    {orders.map((order) => (
                        <div
                            key={order.id}
                            className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-all duration-300 hover:border-gray-200"
                        >
                            <div className="p-6 sm:p-8">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-50 p-2 rounded-lg">
                                                <Package className="text-blue-600" size={20} />
                                            </div>
                                            <h2 className="font-semibold text-gray-900 text-lg">Order #{order.id.slice(0, 8)}</h2>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            {new Date(order.createdAt).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border ${statusColors[order.status]}`}>
                                            {statusIcons[order.status]}
                                            {order.status}
                                        </span>
                                        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${paymentStatusColors[order.paymentStatus]}`}>
                                            {order.paymentStatus}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 my-5"></div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Order Items</h3>
                                        <ul className="space-y-4">
                                            {order.items.map((item, index) => (
                                                <li key={index} className="flex justify-between items-center">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
                                                            {item.image ? (
                                                                <img
                                                                    src={item.image}
                                                                    alt={item.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_18d9b8a6d6a%20text%20%7B%20fill%3A%23AAAAAA%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_18d9b8a6d6a%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23EEEEEE%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2235.5%22%20y%3D%2256.5%22%3E100x100%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E"
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Package className="w-5 h-5 text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                                            <p className="text-xs text-gray-500 mt-1">Quantity: {item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-900">Rs. {(item.price * item.quantity).toLocaleString()}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Payment Details</h3>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="bg-gray-50 p-2 rounded-lg">
                                                    {paymentIcons[order.paymentMethod]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 capitalize">{order.paymentMethod} payment</p>
                                                    {order.transactionId && (
                                                        <p className="text-xs text-gray-500 mt-1">Transaction ID: {order.transactionId}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Shipping Details</h3>
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <p className="text-sm text-gray-700">{order.shippingAddress}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 mt-6 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <p className="text-sm text-gray-500">
                                        {order.items.length} item{order.items.length > 1 ? 's' : ''} • Total
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <p className="text-lg font-bold text-gray-900">Rs. {order.totalPrice.toLocaleString()}</p>
                                        <button
                                            onClick={() => navigate(`/OrderDetails/${order.id}`)}
                                            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 group"
                                        >
                                            View details
                                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MyOrdersPage;