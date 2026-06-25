import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/UserContext";
import { startStripeCheckout } from "../../utils/stripeCheckout";
import {
    Loader2,
    MapPin,
    Edit2,
    PlusCircle,
    ChevronDown,
    Package,
    CreditCard,
    Banknote,
    CheckCircle
} from 'lucide-react';
import emailjs from "emailjs-com";

const CheckoutPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { orderData, productImages } = location.state || {};
    const { user, loading: authLoading } = useAuth();
    const [address, setAddress] = useState(null);
    const [isAddressLoading, setIsAddressLoading] = useState(true);
    const [isAddressFormVisible, setIsAddressFormVisible] = useState(false);
    const [newAddress, setNewAddress] = useState({
        country: '',
        firstName: '',
        lastName: '',
        address: '',
        apartment: '',
        city: '',
        postalCode: '',
        phone: ''
    });
    const [isLoading, setIsLoading] = useState(false);


    useEffect(() => {
        if (!orderData) {
            navigate("/");
        }
    }, [orderData, navigate]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate("/");
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (!cancelled) {
                    setAddress(docSnap.exists() ? docSnap.data().address || null : null);
                }
            } catch (error) {
                console.error("Error fetching address:", error);
                if (!cancelled) setAddress(null);
            } finally {
                if (!cancelled) setIsAddressLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user, authLoading, navigate]);

    const handleChangeAddress = () => {
        setIsAddressFormVisible(true);
        setNewAddress({
            country: address?.country || '',
            firstName: address?.firstName || '',
            lastName: address?.lastName || '',
            address: address?.address || '',
            apartment: address?.apartment || '',
            city: address?.city || '',
            postalCode: address?.postalCode || '',
            phone: address?.phone || ''
        });
    };

    const handleAddressInputChange = (e) => {
        const { name, value } = e.target;
        setNewAddress((prevState) => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSaveAddress = async () => {
        const {
            country,
            firstName,
            lastName,
            address,
            apartment,
            city,
            postalCode,
            phone,
        } = newAddress;

        if (
            !country ||
            !firstName.trim() ||
            !lastName.trim() ||
            !address.trim() ||
            !apartment.trim() ||
            !city.trim() ||
            !postalCode.trim() ||
            !phone.trim()
        ) {
            alert("Please fill out all fields, including the country dropdown.");
            return;
        }

        try {
            if (!user) throw new Error("User not authenticated");

            const userRef = doc(db, "users", user.uid);
            const formattedAddress = `${firstName} ${lastName}, ${address}, ${apartment}, ${city}, ${country}, ${postalCode}, Phone: ${phone}`;

            await setDoc(userRef, { address: formattedAddress }, { merge: true });
            setAddress(formattedAddress);
            setIsAddressFormVisible(false);
            alert("Address saved successfully!");
        } catch (error) {
            console.error("Error saving address:", error);
            alert("Failed to save address.");
        }
    };

    const generateOrderDetailsHTML = (items) => {
        return items.map((item) => {
            const name = item.title || "Unnamed item";
            const price = parseFloat(item.price).toFixed(2) || "0.00";
            const quantity = item.quantity || 1;
            const total = (price * quantity).toFixed(2);

            return `Item: ${name}\nPrice: Rs.${price}\nQuantity: ${quantity}\nTotal: Rs.${total}\n---`;
        }).join("\n");
    };

    const handleCheckout = async () => {
        if (!address) {
            alert("Please provide a valid shipping address.");
            return;
        }

        setIsLoading(true);

        try {
            if (!user) throw new Error("User not authenticated");

            // ── Card payment → hand off to Stripe Checkout ──────────────
            // The order is created server-side (with trusted pricing) and
            // confirmed by the Stripe webhook, so we redirect and stop here.
            if (orderData.paymentMethod === "card") {
                await startStripeCheckout({
                    items: orderData.items,
                    shippingAddress: address,
                });
                return; // browser navigates away to Stripe
            }

            // ── Cash on Delivery → existing Firestore + email flow ──────
            const updatedOrderData = {
                ...orderData,
                shippingAddress: address,
                createdAt: new Date().toISOString(),
            };

            // Save order to Firestore
            const ordersCollection = collection(db, "orders");
            const docRef = await addDoc(ordersCollection, updatedOrderData);

            // Prepare email variables
            const emailVariables = {
                order_details: generateOrderDetailsHTML(updatedOrderData.items),
                shipping_address: updatedOrderData.shippingAddress,
                subtotal: updatedOrderData.totalPrice.toFixed(2),
                total: updatedOrderData.totalPrice.toFixed(2),
                payment_method: updatedOrderData.paymentMethod,
                from_name: user.email || "Customer",
            };

            // Send confirmation email
            await emailjs.send(
                import.meta.env.VITE_EMAILJS_SERVICE_ID,
                import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
                emailVariables,
                import.meta.env.VITE_EMAILJS_PUBLIC_KEY
            );

            alert("Order placed successfully!");
            navigate("/order-confirmation", { state: { orderId: docRef.id, orderData: updatedOrderData } });
        } catch (error) {
            console.error("Error processing checkout:", error);
            alert("Failed to place the order. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Complete Your Order</h1>
                    <p className="mt-2 text-gray-600">Review your items and shipping details</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Shipping and Billing */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Shipping Address Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-semibold text-gray-800">Shipping Address</h2>
                                </div>
                            </div>
                            <div className="p-5">
                                {isAddressLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                    </div>
                                ) : address ? (
                                    <div className="space-y-4">
                                        <div className="bg-blue-50 rounded-lg p-4">
                                            <p className="text-gray-700 whitespace-pre-line">{address}</p>
                                        </div>
                                        <button
                                            onClick={handleChangeAddress}
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Change Address
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsAddressFormVisible(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                    >
                                        <PlusCircle className="w-5 h-5" />
                                        Add Shipping Address
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Address Form */}
                        {isAddressFormVisible && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
                                <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                                    <h2 className="text-lg font-semibold text-gray-800">
                                        {address ? 'Update Address' : 'Add New Address'}
                                    </h2>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Country/Region*</label>
                                        <div className="relative">
                                            <select
                                                name="country"
                                                value={newAddress.country}
                                                onChange={handleAddressInputChange}
                                                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                                            >
                                                <option value="">Select Country</option>
                                                <option value="PAKISTAN">Pakistan</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                value={newAddress.firstName}
                                                onChange={handleAddressInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name*</label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                value={newAddress.lastName}
                                                onChange={handleAddressInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address*</label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={newAddress.address}
                                            onChange={handleAddressInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Apartment</label>
                                        <input
                                            type="text"
                                            name="apartment"
                                            value={newAddress.apartment}
                                            onChange={handleAddressInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">City*</label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={newAddress.city}
                                                onChange={handleAddressInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code*</label>
                                            <input
                                                type="text"
                                                name="postalCode"
                                                value={newAddress.postalCode}
                                                onChange={handleAddressInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number*</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={newAddress.phone}
                                            onChange={handleAddressInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={handleSaveAddress}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            Save Address
                                        </button>
                                        <button
                                            onClick={() => setIsAddressFormVisible(false)}
                                            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Payment Method */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                                <h2 className="text-lg font-semibold text-gray-800">Payment Method</h2>
                            </div>
                            <div className="p-5">
                                <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                                    {orderData?.paymentMethod === 'card' ? (
                                        <>
                                            <CreditCard className="w-6 h-6 text-blue-600" />
                                            <span className="font-medium">Credit/Debit Card</span>
                                        </>
                                    ) : (
                                        <>
                                            <Banknote className="w-6 h-6 text-blue-600" />
                                            <span className="font-medium">Cash on Delivery</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Order Summary */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-8">
                            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                                <h2 className="text-lg font-semibold text-gray-800">Order Summary</h2>
                            </div>
                            <div className="p-5">
                                <div className="space-y-4">
                                    {orderData?.items?.map((item, index) => (
                                        <div key={index} className="flex items-start gap-4 pb-4 border-b border-gray-100">
                                            <div className="relative">
                                                <img
                                                    src={productImages?.[index] || ""}  // Changed to productImages
                                                    alt={item.title}
                                                    className="w-16 h-16 object-cover rounded-md border border-gray-200"
                                                />
                                                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                    {item.quantity}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800 line-clamp-2">{item.title}</p>
                                                <p className="text-sm text-gray-600">Rs.{item.price.toFixed(2)} each</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium text-gray-900">Rs.{(item.price * item.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 space-y-3">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span>Rs.{orderData?.totalPrice?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Shipping</span>
                                        <span className="text-green-600">Free</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Tax</span>
                                        <span>Rs.0.00</span>
                                    </div>
                                    <div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-gray-900">
                                        <span>Total</span>
                                        <span>Rs.{orderData?.totalPrice?.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCheckout}
                                    disabled={isLoading || !address}
                                    className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white transition-all ${isLoading || !address ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg'}`}
                                >
                                    {isLoading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Processing...
                                        </div>
                                    ) : (
                                        'Place Order'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPage;