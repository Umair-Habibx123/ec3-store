import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import LoadingSpinner from "../../utils/LoadingSpinner"
import {
  ArrowLeft,
  Plus,
  Minus,
  Home,
  MapPin,
  CreditCard,
  Wallet,
  ChevronDown
} from 'lucide-react';

const BuyNowPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { product, products } = location.state || {};
  const [quantity, setQuantity] = useState(1);
  const [totalAmount, setTotalAmount] = useState(
    product?.discountedPrice || products?.reduce((sum, p) => sum + (p.price * (p.quantity || 1)), 0) || 0
  );
  const [address, setAddress] = useState(null);
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  const [isAddressFormVisible, setIsAddressFormVisible] = useState(false);
  const isMultipleProducts = !!products;
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
  const [paymentMethod, setPaymentMethod] = useState('cash');


  useEffect(() => {
    if (!product && !products) {
      navigate("/");
    } else {
      if (isMultipleProducts) {
        setTotalAmount(
          products.reduce((sum, p) => sum + (p.price * (p.quantity || 1)), 0)
        );
      } else {
        setTotalAmount(
          product?.discountedPrice ? product.discountedPrice * quantity : 0
        );
      }
    }
  }, [product, products, quantity, navigate, isMultipleProducts]);



  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        (async () => {
          try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const data = docSnap.data();
              setAddress(data.address || null);
            } else {
              setAddress(null);
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            setAddress(null);
          } finally {
            setIsAddressLoading(false);
          }
        })();
      } else {
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

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
      const auth = getAuth();
      const user = auth.currentUser;
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

  const handleCheckout = async () => {
    if (!address) {
      alert("Please provide your address before proceeding.");
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert("User not authenticated");
      return;
    }

    const orderData = {
      userId: user.uid,
      items: isMultipleProducts
        ? products.map(p => ({
          productId: p.productId || "",
          title: p.title || "Unnamed product",
          price: parseFloat(p.price) || 0,
          quantity: p.quantity || 1,
          image: p.image || "",
        }))
        : [{
          productId: product?.id || "",
          title: product?.title || "Unnamed product",
          price: parseFloat(product?.discountedPrice) || 0,
          quantity: quantity || 1,
          image: product?.image || "",
        }],
      totalPrice: parseFloat(totalAmount.toFixed(2)),
      shippingAddress: address,
      status: "pending",
      paymentStatus: "unpaid",
      paymentMethod: paymentMethod,
      createdAt: new Date().toISOString(),
    };

    navigate("/checkout", {
      state: {
        orderData,
        productImages: isMultipleProducts
          ? products.map(p => p.image || "")
          : product?.image ? [product.image] : [],
      },
    });
  };

  const increaseQuantity = () => {
    if (product && product.discountedPrice) {
      setQuantity((prevQuantity) => {
        const updatedQuantity = prevQuantity + 1;
        setTotalAmount((product.discountedPrice || 0) * updatedQuantity);
        return updatedQuantity;
      });
    }
  };

  const decreaseQuantity = () => {
    if (product && product.discountedPrice && quantity > 1) {
      setQuantity((prevQuantity) => {
        const updatedQuantity = prevQuantity - 1;
        setTotalAmount((product.discountedPrice || 0) * updatedQuantity);
        return updatedQuantity;
      });
    }
  };

  if (!product) {
    <div className="fixed inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm z-50">
      <LoadingSpinner size="xl" />
    </div>
  }



  const renderProductSection = () => {
    if (isMultipleProducts) {
      return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-5 flex items-center">
            <Home className="w-5 h-5 mr-2 text-blue-600" />
            Product Details ({products.length} items)
          </h2>

          <div className="space-y-5">
            {products.map((product, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="w-full sm:w-24 h-24 bg-white rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                  <img
                    src={product?.image}
                    alt={product?.title}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 w-full">
                  <h3 className="text-md font-semibold text-gray-900">{product?.title}</h3>
                  <p className="text-gray-600 mt-1">Price: Rs. {product?.price?.toLocaleString()}</p>

                  <div className="mt-2 flex items-center text-sm text-gray-700">
                    <span className="mr-2 font-medium">Quantity:</span>
                    <span className="text-gray-800">{product.quantity || 1}</span>
                  </div>
                </div>

                <div className="text-right sm:ml-auto">
                  <p className="text-md font-bold text-gray-900">
                    Rs. {(product.price * (product.quantity || 1)).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-gray-200 text-right">
              <p className="text-xl font-bold text-gray-900">
                Total: Rs. {Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-5 flex items-center">
            <Home className="w-5 h-5 mr-2 text-blue-600" />
            Product Details
          </h2>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-40 h-40 bg-white rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
              <img
                src={product?.image}
                alt={product?.title}
                className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
              />
            </div>

            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">{product?.title}</h3>
              <p className="text-gray-600 mt-2">Price: Rs. {product?.discountedPrice?.toLocaleString()}</p>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-gray-700 font-medium">Quantity:</span>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={decreaseQuantity}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 transition"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-1 min-w-[40px] text-center text-gray-900 font-medium">
                    {quantity}
                  </span>
                  <button
                    onClick={increaseQuantity}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 text-right">
                <p className="text-xl font-bold text-gray-900">
                  Total: Rs. {Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };




  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-6 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to shopping
        </button>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 md:p-8 text-white">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold">Complete Your Purchase</h1>
              <p className="text-blue-100 mt-2 opacity-90">Review your items and shipping details</p>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            {/* Product Section */}
            {renderProductSection()}

            {/* Address Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  Shipping Address
                </h2>
                {address && !isAddressFormVisible && (
                  <button
                    onClick={handleChangeAddress}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors px-3 py-1 rounded-md hover:bg-blue-50"
                  >
                    Change
                  </button>
                )}
              </div>

              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
                {isAddressLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ) : address ? (
                  <div>
                    <p className="text-gray-700 whitespace-pre-line">{address}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddressFormVisible(true)}
                    className="w-full text-center text-blue-600 hover:text-blue-800 font-medium py-3 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Shipping Address
                  </button>
                )}
              </div>
            </div>

            {/* Address Form */}
            {isAddressFormVisible && (
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm animate-fade-in">
                <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  Shipping Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Country/Region*</label>
                    <div className="relative">
                      <select
                        name="country"
                        value={newAddress.country}
                        onChange={handleAddressInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                      >
                        <option value="">Select Country</option>
                        <option value="PAKISTAN">Pakistan</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">First Name*</label>
                    <input
                      type="text"
                      name="firstName"
                      value={newAddress.firstName}
                      onChange={handleAddressInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter first name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Last Name*</label>
                    <input
                      type="text"
                      name="lastName"
                      value={newAddress.lastName}
                      onChange={handleAddressInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter last name"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Address*</label>
                    <input
                      type="text"
                      name="address"
                      value={newAddress.address}
                      onChange={handleAddressInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Street address"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Apartment*</label>
                    <input
                      type="text"
                      name="apartment"
                      value={newAddress.apartment}
                      onChange={handleAddressInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Apartment, suite, etc. (optional)"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">City*</label>
                    <input
                      type="text"
                      name="city"
                      value={newAddress.city}
                      onChange={handleAddressInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter city"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Postal Code*</label>
                    <input
                      type="text"
                      name="postalCode"
                      value={newAddress.postalCode}
                      onChange={handleAddressInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter postal code"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Phone Number*</label>
                    <input
                      type="text"
                      name="phone"
                      value={newAddress.phone}
                      onChange={handleAddressInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end space-x-4">
                  <button
                    onClick={() => setIsAddressFormVisible(false)}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAddress}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
                  >
                    Save Address
                  </button>
                </div>
              </div>
            )}

            {/* Payment Method */}
            {/* Payment Method */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Payment Method</h2>

              <div className="space-y-4">
                <div
                  className={`p-5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 flex-shrink-0 ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {paymentMethod === 'cash' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <Wallet className="w-6 h-6 text-gray-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-800">Cash on Delivery</h3>
                      <p className="text-sm text-gray-500 mt-1">Pay when you receive your order</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-5 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 flex-shrink-0 ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {paymentMethod === 'card' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <CreditCard className="w-6 h-6 text-gray-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-800">Credit/Debit Card</h3>
                      <p className="text-sm text-gray-500 mt-1">Secure online payment</p>
                    </div>
                  </div>

                  {paymentMethod === 'card' && (
                    <div className="mt-4 pl-12 animate-fade-in">
                      <p className="text-gray-500 text-sm">
                        You'll be securely redirected to Stripe to complete your payment.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* Order Summary */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Order Summary</h2>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">Rs. {Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>
                <div className="border-t border-gray-200 pt-4 flex justify-between">
                  <span className="text-lg font-semibold text-gray-800">Total</span>
                  <span className="text-xl font-bold text-blue-600">
                    Rs. {Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={!address}
              className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center transition-all duration-200
    ${!address
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-200 cursor-not-allowed shadow-inner'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg'}
  `}
            >
              Proceed to Checkout
              <ArrowLeft className="w-5 h-5 ml-2 transform rotate-180" />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyNowPage;