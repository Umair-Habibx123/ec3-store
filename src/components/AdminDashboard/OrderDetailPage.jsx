import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import {
    ArrowLeft,
    Package,
    CreditCard,
    Truck,
    CheckCircle,
    Clock,
    XCircle,
    MapPin,
    User,
    Mail,
    Calendar,
    Loader2,
    ChevronDown
} from "lucide-react";

function OrderDetailPage() {
    const { orderId } = useParams();
    const [orderDetails, setOrderDetails] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [productDetails, setProductDetails] = useState({});
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const fetchOrderDetails = async () => {
            try {
                // Fetch order details
                const orderRef = doc(db, 'orders', orderId);
                const orderSnapshot = await getDoc(orderRef);

                if (!orderSnapshot.exists()) {
                    setLoading(false);
                    return;
                }

                const orderData = {
                    id: orderId,
                    ...orderSnapshot.data(),
                    createdAt: orderSnapshot.data().createdAt instanceof Timestamp
                        ? orderSnapshot.data().createdAt.toDate()
                        : new Date(orderSnapshot.data().createdAt)
                };
                setOrderDetails(orderData);

                // Fetch user details
                if (orderData.userId) {
                    const userRef = doc(db, 'users', orderData.userId);
                    const userSnapshot = await getDoc(userRef);
                    if (userSnapshot.exists()) {
                        setUserDetails({
                            id: userSnapshot.id,
                            ...userSnapshot.data()
                        });
                    }
                }

                // Fetch product details for each item in the order
                if (orderData.items && orderData.items.length > 0) {
                    const productPromises = orderData.items.map(async (item) => {
                        const productRef = doc(db, 'products', item.productId);
                        const productSnapshot = await getDoc(productRef);
                        if (productSnapshot.exists()) {
                            return {
                                id: productSnapshot.id,
                                ...productSnapshot.data()
                            };
                        }
                        return null;
                    });

                    const products = await Promise.all(productPromises);
                    const productMap = {};
                    products.forEach((product, index) => {
                        if (product) {
                            productMap[orderData.items[index].productId] = product;
                        }
                    });
                    setProductDetails(productMap);
                }

            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrderDetails();
    }, [orderId]);

    const handleStatusUpdate = async (field, value) => {
        try {
            setUpdating(true);
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, { [field]: value });
            setOrderDetails(prev => ({ ...prev, [field]: value }));
        } catch (error) {
            console.error(`Error updating ${field}: `, error);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "confirmed":
                return "bg-blue-100 text-blue-800";
            case "shipped":
                return "bg-purple-100 text-purple-800";
            case "delivered":
                return "bg-green-100 text-green-800";
            case "cancelled":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const getPaymentStatusColor = (status) => {
        switch (status) {
            case "paid":
                return "bg-green-100 text-green-800";
            case "unpaid":
                return "bg-yellow-100 text-yellow-800";
            case "failed":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case "pending":
                return <Clock className="w-4 h-4" />;
            case "confirmed":
                return <CheckCircle className="w-4 h-4" />;
            case "shipped":
                return <Truck className="w-4 h-4" />;
            case "delivered":
                return <Package className="w-4 h-4" />;
            case "cancelled":
                return <XCircle className="w-4 h-4" />;
            default:
                return <Clock className="w-4 h-4" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (!orderDetails) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 max-w-md bg-white rounded-lg shadow-md">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
                    <p className="text-gray-600 mb-6">
                        The order you're looking for doesn't exist or may have been removed.
                    </p>
                    <a
                        href="/admin/orders"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Orders
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="-mt-[70px] min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <Package className="w-6 h-6 mr-2 text-blue-600" />
                                Order #{orderId.slice(0, 8).toUpperCase()}
                            </h1>
                            <p className="text-gray-500 mt-1 flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {orderDetails.createdAt?.toLocaleString() || "N/A"}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                                    orderDetails.status
                                )}`}
                            >
                                {getStatusIcon(orderDetails.status)}
                                <span className="ml-1 capitalize">{orderDetails.status}</span>
                            </span>
                            <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(
                                    orderDetails.paymentStatus
                                )}`}
                            >
                                <CreditCard className="w-4 h-4" />
                                <span className="ml-1 capitalize">{orderDetails.paymentStatus}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Order Action Bar */}
                <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center space-x-2">
                            <h2 className="text-lg font-semibold text-gray-800">Order Actions</h2>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="relative">
                                <select
                                    value={orderDetails.status || ""}
                                    onChange={(e) => handleStatusUpdate("status", e.target.value)}
                                    className="appearance-none pl-3 pr-8 py-2 border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    disabled={updating}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={orderDetails.paymentStatus || ""}
                                    onChange={(e) => handleStatusUpdate("paymentStatus", e.target.value)}
                                    className="appearance-none pl-3 pr-8 py-2 border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    disabled={updating}
                                >
                                    <option value="unpaid">Unpaid</option>
                                    <option value="paid">Paid</option>
                                    <option value="failed">Failed</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer Information */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                    <User className="w-5 h-5 mr-2 text-blue-600" />
                                    Customer Information
                                </h2>
                            </div>
                            <div className="px-6 py-4 space-y-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <User className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-500">Customer</p>
                                        <p className="text-sm text-gray-900">
                                            {userDetails?.username || orderDetails.user?.username || "N/A"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <Mail className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-500">Email</p>
                                        <p className="text-sm text-gray-900">
                                            {userDetails?.email || orderDetails.user?.email || "N/A"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <MapPin className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-500">Shipping Address</p>
                                        <p className="text-sm text-gray-900">
                                            {orderDetails.shippingAddress || userDetails?.address || "N/A"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                    <Package className="w-5 h-5 mr-2 text-blue-600" />
                                    Order Items ({orderDetails.items?.length || 0})
                                </h2>
                            </div>
                            <div className="divide-y divide-gray-200">
                                {orderDetails.items?.length > 0 ? (
                                    orderDetails.items.map((item, index) => {
                                        const product = productDetails[item.productId] || {};
                                        return (
                                            <div key={index} className="p-6">
                                                <div className="flex flex-col sm:flex-row">
                                                    <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-6">
                                                        <img
                                                            src={product.image || item.image || "/placeholder-image.png"}
                                                            alt={product.title || item.name}
                                                            className="w-20 h-20 object-cover rounded-md"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-col sm:flex-row sm:justify-between">
                                                            <div>
                                                                <h3 className="text-base font-medium text-gray-900">
                                                                    {product.title || item.name || "Product Name"}
                                                                </h3>
                                                                <p className="mt-1 text-sm text-gray-500">
                                                                    SKU: {item.productId}
                                                                </p>
                                                                {product.attributes && (
                                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                                        {product.attributes.map((attr, i) => (
                                                                            <span key={i} className="text-xs text-gray-500">
                                                                                {attr.name}: {attr.value}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="mt-2 sm:mt-0 text-base font-medium text-gray-900">
                                                                Rs. {item.price}
                                                            </p>
                                                        </div>
                                                        <div className="mt-4 flex items-center">
                                                            <span className="text-sm text-gray-500 mr-4">
                                                                Qty: {item.quantity}
                                                            </span>
                                                            <span className="text-sm font-medium text-gray-900">
                                                                Total: Rs. {(item.price * item.quantity).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 text-center text-gray-500">No items found in this order.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Order Summary */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                    <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                                    Payment Information
                                </h2>
                            </div>
                            <div className="px-6 py-4 space-y-4">
                                <div className="flex justify-between">
                                    <p className="text-sm font-medium text-gray-500">Payment Method</p>
                                    <p className="text-sm text-gray-900 capitalize">
                                        {orderDetails.paymentMethod || "N/A"}
                                    </p>
                                </div>
                                {orderDetails.transactionId && (
                                    <div className="flex justify-between">
                                        <p className="text-sm font-medium text-gray-500">Transaction ID</p>
                                        <p className="text-sm text-gray-900 break-all">
                                            {orderDetails.transactionId}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800">Order Summary</h2>
                            </div>
                            <div className="px-6 py-4 space-y-3">
                                <div className="flex justify-between">
                                    <p className="text-sm font-medium text-gray-500">Subtotal</p>
                                    <p className="text-sm text-gray-900">Rs. {orderDetails.totalPrice?.toFixed(2) || "0.00"}</p>
                                </div>
                                <div className="flex justify-between">
                                    <p className="text-sm font-medium text-gray-500">Shipping</p>
                                    <p className="text-sm text-gray-900">Rs. 0.00</p>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-3">
                                    <p className="text-base font-medium text-gray-900">Total</p>
                                    <p className="text-base font-bold text-gray-900">
                                        Rs. {orderDetails.totalPrice?.toFixed(2) || "0.00"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Order Timeline */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800">Order Timeline</h2>
                            </div>
                            <div className="px-6 py-4">
                                <div className="flow-root">
                                    <ul className="-mb-8">
                                        <li>
                                            <div className="relative pb-8">
                                                <div className="relative flex items-start space-x-3">
                                                    <div>
                                                        <div className="relative px-1">
                                                            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <Package className="h-5 w-5 text-blue-600" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1 py-1.5">
                                                        <div className="text-sm text-gray-500">
                                                            <span className="font-medium text-gray-900">
                                                                Order created
                                                            </span>
                                                            <span className="whitespace-nowrap">
                                                                {" "}
                                                                on {orderDetails.createdAt?.toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="relative pb-8">
                                                <div className="relative flex items-start space-x-3">
                                                    <div>
                                                        <div className="relative px-1">
                                                            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <CreditCard className="h-5 w-5 text-blue-600" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1 py-1.5">
                                                        <div className="text-sm text-gray-500">
                                                            <span className="font-medium text-gray-900">
                                                                Payment {orderDetails.paymentStatus}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="relative pb-8">
                                                <div className="relative flex items-start space-x-3">
                                                    <div>
                                                        <div className="relative px-1">
                                                            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <Truck className="h-5 w-5 text-blue-600" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1 py-1.5">
                                                        <div className="text-sm text-gray-500">
                                                            <span className="font-medium text-gray-900">
                                                                Order {orderDetails.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default OrderDetailPage;