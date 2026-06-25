import React, { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import html2canvas from "html2canvas";

const OrderConfirmationPage = () => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const stateData = location.state || {};

    // Two entry paths:
    //  1. COD flow passes order via router state.
    //  2. Stripe redirects back with ?order_id=...&status=success — we fetch it.
    const queryOrderId = searchParams.get("order_id");
    const [orderId, setOrderId] = useState(stateData.orderId || queryOrderId || null);
    const [orderData, setOrderData] = useState(stateData.orderData || null);

    useEffect(() => {
        if (orderData || !queryOrderId) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "orders", queryOrderId));
                if (snap.exists()) {
                    setOrderData(snap.data());
                    setOrderId(snap.id);
                }
            } catch (error) {
                console.error("Error loading order:", error);
            }
        })();
    }, [queryOrderId, orderData]);

    const handleCaptureScreenshot = () => {
        const element = document.getElementById("orderConfirmationContent");
    
        const clone = element.cloneNode(true);
        clone.style.backgroundColor = "white";
        clone.style.color = "black";
        document.body.appendChild(clone);
    
        // Fix unsupported CSS color functions
        clone.querySelectorAll("*").forEach((node) => {
            node.style.backgroundColor = "white";
            node.style.color = "black";
        });
    
        html2canvas(clone, {
            backgroundColor: "#ffffff",
            logging: true,
            useCORS: true,
            scale: 2
        }).then((canvas) => {
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `order_${orderId}.png`;
            link.click();
            document.body.removeChild(clone);
        }).catch(error => {
            console.error("Error generating screenshot:", error);
            document.body.removeChild(clone);
        });
    };
    

    const goBack = () => {
        window.location.href = "/";
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "Not available";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    };

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            <div
                id="orderConfirmationContent"
                className="max-w-6xl mx-auto bg-white shadow-lg rounded-lg p-6 sm:p-8 md:p-10"
                style={{
                    // Explicit styles to avoid CSS that might cause issues with html2canvas
                    color: '#000000',
                    backgroundColor: '#ffffff'
                }}
            >
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 text-center">
                    Order Confirmation
                </h2>
                <p className="text-lg sm:text-xl text-gray-800 text-center">
                    Thank you for your order!
                </p>
                <p className="text-gray-600 text-sm sm:text-base text-center">
                    Order ID: {orderId || "Not available"}
                </p>

                {/* Order Meta Information */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-700">Order Date</h3>
                        <p>{formatDate(orderData?.createdAt)}</p>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-700">Order Status</h3>
                        <p className="capitalize">{orderData?.status || "pending"}</p>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-700">Payment Method</h3>
                        <p className="capitalize">{orderData?.paymentMethod || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-700">Payment Status</h3>
                        <p className="capitalize">{orderData?.paymentStatus || "Not specified"}</p>
                    </div>
                </div>

                {/* Shipping Address */}
                <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Shipping Address</h3>
                    <p className="text-gray-700 whitespace-pre-line">
                        {orderData?.shippingAddress || "No address provided"}
                    </p>
                </div>

                {/* Order Items */}
                <h3 className="mt-6 text-lg sm:text-xl font-semibold text-gray-800">Order Summary:</h3>
                <ul className="mt-2 space-y-4">
                    {orderData?.items?.map((item, index) => (
                        <li
                            key={index}
                            className="flex flex-wrap justify-between items-center space-y-4 sm:space-y-0 sm:flex-nowrap p-4 bg-gray-100 rounded-lg"
                        >
                            <div className="w-full sm:w-auto">
                                {/* Updated item name access - adjust based on your actual data structure */}
                                <span className="font-semibold text-lg text-gray-800">
                                    {item.title}
                                </span> <br />
                                <span className="text-sm sm:text-base text-gray-500">
                                    Price: Rs.{item.price?.toFixed(2) || "0.00"} x {item.quantity || 1}
                                </span>
                            </div>
                            <div className="w-full sm:w-auto text-right">
                                <span className="font-bold text-lg text-gray-800">
                                    Rs.{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>

                {/* Order Totals */}
                <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                    <div className="flex justify-between mb-2">
                        <span className="font-semibold">Subtotal:</span>
                        <span>Rs.{orderData?.totalPrice?.toFixed(2) || "0.00"}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="font-semibold">Shipping:</span>
                        <span>Rs.0.00</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                        <span>Grand Total:</span>
                        <span>Rs.{orderData?.totalPrice?.toFixed(2) || "0.00"}</span>
                    </div>
                </div>

                {/* Important Information Section */}
                <div className="mt-8 p-6 bg-blue-50 rounded-md border border-blue-200">
                    <h4 className="text-lg sm:text-xl font-semibold text-blue-700">
                        Important Information
                    </h4>
                    <p className="text-sm sm:text-base text-blue-600 mt-2">
                        Please save your order ID for future reference. You can also find it in the "My Orders" section.
                        If you have any questions or need assistance, feel free to contact our support team and provide your order ID for faster service.
                    </p>
                </div>

                {/* Buttons Section */}
                <div className="mt-6 flex flex-col sm:flex-row sm:justify-between space-y-4 sm:space-y-0">
                    <button
                        onClick={handleCaptureScreenshot}
                        className="bg-blue-600 text-white p-3 sm:p-4 rounded-lg w-full sm:w-auto text-center"
                    >
                        Capture Screenshot
                    </button>
                    <button
                        onClick={goBack}
                        className="bg-gray-600 text-white p-3 sm:p-4 rounded-lg w-full sm:w-auto text-center"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderConfirmationPage;