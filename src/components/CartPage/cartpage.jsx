import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "../../context/UserContext";
import { ShoppingBag, Trash2, Plus, Minus, Check, ChevronRight, Loader2 } from "lucide-react";

const CartPage = () => {
    const currentUser = useUser();
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    const [cart, setCart] = useState([]);
    const [validCartItems, setValidCartItems] = useState([]);
    const [, setUser] = useState(null);
    const [, setProfilePic] = useState("/default-profile.png");
    const [totalPrice, setTotalPrice] = useState(0);
    const [selectedItems, setSelectedItems] = useState([]);
    const [, setUserRole] = useState("user");
    const [selectAll, setSelectAll] = useState(false);
    const [loadingItem, setLoadingItem] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (currentUser) {
            const fetchCart = async () => {
                setIsLoading(true);
                try {
                    const cartItemsRef = collection(db, "userCart", currentUser.uid, "cartItems");
                    const cartItemsSnapshot = await getDocs(cartItemsRef);

                    const items = cartItemsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    const validatedItems = await Promise.all(
                        items.map(async (item) => {
                            try {
                                const productRef = doc(db, "products", item.productId);
                                const productSnap = await getDoc(productRef);

                                if (productSnap.exists()) {
                                    const productData = productSnap.data();
                                    if (productData.isDeleted === true) {
                                        await deleteDoc(doc(db, "userCart", currentUser.uid, "cartItems", item.id));
                                        return null;
                                    }
                                    // Return item with updated product data
                                    return {
                                        ...item,
                                        title: productData.title || item.title,
                                        price: productData.price || item.price,
                                        image: productData.image || item.image
                                    };
                                } else {

                                    await deleteDoc(doc(db, "userCart", currentUser.uid, "cartItems", item.id));
                                    return null;
                                }
                            } catch (error) {
                                console.error("Error validating product:", error);
                                return item; 
                            }
                        })
                    );

                    // Filter out null items (deleted products)
                    const filteredItems = validatedItems.filter(item => item !== null);

                    setCart(filteredItems);
                    setValidCartItems(filteredItems);
                    calculateTotalPrice(filteredItems, selectedItems);
                } catch (error) {
                    console.error("Error fetching cart:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchCart();
        }
    }, [currentUser, selectedItems]);

    useEffect(() => {
        calculateTotalPrice(validCartItems, selectedItems);
    }, [selectedItems, validCartItems]);


    const handleSignIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();

                setUserRole(userData.role || "user");
                setProfilePic(userData.profilePic || "/default-profile.png");
                window.location.reload();
            } else {
                await setDoc(userDocRef, {
                    email: user.email,
                    username: user.displayName,
                    profilePic: user.photoURL || "/default-profile.png",
                    role: "user",
                    address: "",
                    createdAt: serverTimestamp(),
                    blocked: false
                });
                setProfilePic(user.photoURL || "/default-profile.png");
                setUserRole("user");
                window.location.reload();
            }

            setUser(user);
        } catch (error) {
            console.error("Error logging in with Google:", error);
        }
    };
    const handleRemoveItem = async (itemId) => {
        if (!currentUser) return;

        setLoadingItem(itemId);
        try {
            await deleteDoc(doc(db, "userCart", currentUser.uid, "cartItems", itemId));
            setCart(prev => prev.filter(item => item.id !== itemId));
            setSelectedItems(prev => prev.filter(id => id !== itemId));
        } catch (error) {
            console.error("Error removing item from cart:", error);
        } finally {
            setLoadingItem(null);
        }
    };

    const handleQuantityChange = async (itemId, change) => {
        if (!currentUser) return;

        setLoadingItem(itemId);
        const itemToUpdate = cart.find(item => item.id === itemId);
        const newQuantity = Math.max(1, (itemToUpdate.quantity || 1) + change);

        try {
            await setDoc(
                doc(db, "userCart", currentUser.uid, "cartItems", itemId),
                { quantity: newQuantity },
                { merge: true }
            );

            setCart(prev => prev.map(item =>
                item.id === itemId ? { ...item, quantity: newQuantity } : item
            ));
        } catch (error) {
            console.error("Error updating item quantity:", error);
        } finally {
            setLoadingItem(null);
        }
    };

    const handleItemSelect = (itemId) => {
        setSelectedItems(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedItems([]);
        } else {
            setSelectedItems(cart.map(item => item.id));
        }
        setSelectAll(!selectAll);
    };

    const calculateTotalPrice = (cartItems, selectedItems) => {
        const total = cartItems
            .filter(item => selectedItems.includes(item.id))
            .reduce((acc, item) => {
                const price = typeof item.price === "number" ? item.price : parseFloat(item.price);
                return acc + (isNaN(price) ? 0 : price * (item.quantity || 1));
            }, 0);
        setTotalPrice(total);
    };

    if (!currentUser) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
                    <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Cart is Waiting</h2>
                    <p className="text-gray-600 mb-6">Sign in to view and manage your shopping cart</p>
                    <button
                        onClick={handleSignIn}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Cart Section */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <ShoppingBag className="w-6 h-6 text-indigo-600" />
                                <h1 className="text-2xl font-bold text-gray-800">Your Cart</h1>
                                <span className="ml-auto bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                                    {validCartItems.length} {validCartItems.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="p-12 flex justify-center">
                                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                            </div>
                        ) : validCartItems.length === 0 ? (
                            <div className="p-12 text-center">
                                <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-medium text-gray-500">Your cart is empty</h3>
                                <p className="text-gray-400 mt-1">Start shopping to add items</p>
                                <Link
                                    to="/"
                                    className="mt-6 inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Continue Shopping
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 border-b border-gray-200 bg-gray-50">
                                    <div className="flex items-center">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectAll}
                                                onChange={handleSelectAll}
                                                className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">
                                                Select all items
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <ul className="divide-y divide-gray-200">
                                    {validCartItems.map((item) => (
                                        <li key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="flex items-center h-16">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.includes(item.id)}
                                                        onChange={() => handleItemSelect(item.id)}
                                                        className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                    />
                                                </div>

                                                <div className="flex-shrink-0">
                                                    <img
                                                        src={item.image || "/default-item.png"}
                                                        alt={item.title}
                                                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base font-medium text-gray-900 truncate">
                                                        {item.title}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        Rs. {item.price.toLocaleString()}
                                                    </p>

                                                    <div className="mt-3 flex items-center gap-3">
                                                        {loadingItem === item.id ? (
                                                            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleQuantityChange(item.id, -1)}
                                                                    disabled={item.quantity <= 1}
                                                                    className={`p-1 rounded-md ${item.quantity <= 1 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-100'}`}
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <span className="text-sm font-medium w-6 text-center">
                                                                    {item.quantity}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleQuantityChange(item.id, 1)}
                                                                    className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end">
                                                    <p className="text-base font-medium text-gray-900">
                                                        Rs. {(item.price * item.quantity).toLocaleString()}
                                                    </p>
                                                    <button
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="mt-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                        disabled={loadingItem === item.id}
                                                    >
                                                        {loadingItem === item.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    {/* Summary Section */}
                    <div className="lg:w-96 bg-white rounded-xl shadow-sm overflow-hidden h-fit sticky top-6">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800">Order Summary</h2>
                        </div>

                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Selected Items</span>
                                    <span className="font-medium">{selectedItems.length}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span className="font-medium">Rs. {totalPrice.toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-600">Shipping</span>
                                    <span className="font-medium">Free</span>
                                </div>

                                <div className="border-t border-gray-200 pt-4 mt-4">
                                    <div className="flex justify-between">
                                        <span className="text-lg font-bold text-gray-900">Total</span>
                                        <span className="text-lg font-bold text-gray-900">
                                            Rs. {totalPrice.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <Link
                                to="/BuyNow"
                                state={{
                                    products: validCartItems.filter(item => selectedItems.includes(item.id)),
                                    productImages: validCartItems
                                        .filter(item => selectedItems.includes(item.id))
                                        .map(item => item.image),
                                    totalAmount: totalPrice,
                                }}
                            >
                                <button
                                    disabled={selectedItems.length === 0}
                                    className={`mt-6 w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${selectedItems.length > 0 ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-md' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                                >
                                    Proceed to Checkout
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartPage;