import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc , updateDoc, addDoc, serverTimestamp, } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { useUser } from "../../context/UserContext";
import { db } from "../../firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import ProductCard from "./ProductCard";
import { Star, ChevronRight, X, ShoppingCart, Zap, Shield, Info, ChevronLeft, ChevronRight as RightIcon } from 'lucide-react';


const ProductDetail = () => {
    const { id: productId } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const userContext = useUser();
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState("user");
    const [added, setAdded] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [loadingAddToCart] = useState(false);
    const navigate = useNavigate();
    const [, setProfilePic] = useState("/default-profile.png");
    const [, setUser] = useState(null);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [categoryDetails, setCategoryDetails] = useState(null);
    const [inventory, setInventory] = useState(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [showFullscreen, setShowFullscreen] = useState(false);

    const provider = new GoogleAuthProvider();

    useEffect(() => {
        if (!productId) {
            console.error("No productId provided");
            setError("No productId provided");
            setLoading(false);
            return;
        }

        const fetchProductData = async () => {
            try {
                const productRef = doc(db, "products", productId);
                const productSnap = await getDoc(productRef);

                if (!productSnap.exists()) {
                    throw new Error("Product not found");
                }

                const productData = productSnap.data();
                setProduct({ ...productData, id: productId });

                // Fetch category details if categoryId exists
                if (productData.categoryId) {
                    const categoryRef = doc(db, "categories", productData.categoryId);
                    const categorySnap = await getDoc(categoryRef);
                    if (categorySnap.exists()) {
                        setCategoryDetails(categorySnap.data());
                    }
                }

                // Fetch inventory details
                const inventoryRef = doc(db, "inventory", productId);
                const inventorySnap = await getDoc(inventoryRef);
                if (inventorySnap.exists()) {
                    setInventory(inventorySnap.data());
                }

                // Fetch related products (same category)
                if (productData.categoryId) {
                    const q = query(
                        collection(db, "products"),
                        where("categoryId", "==", productData.categoryId),
                        where("id", "!=", productId),
                        limit(5)
                    );
                    const querySnapshot = await getDocs(q);
                    const related = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setRelatedProducts(related);
                }

            } catch (err) {
                console.error("Error fetching product data:", err);
                setError("Failed to fetch product details.");
            } finally {
                setLoading(false);
            }
        };

        fetchProductData();
    }, [productId]);

    // User authentication and role management
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                // Fetch user's role from Firestore
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setUserRole(userData.role || "user");
                    setProfilePic(userData.profilePic || "/default-profile.png");
                }
            } else {
                setUser(null);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleThumbnailClick = (index) => {
        setSelectedImage(index);
    };

    const handleNextImage = () => {
        setSelectedImage(prev =>
            (prev + 1) % (product.additionalImages ? product.additionalImages.length + 1 : 1)
        );
    };

    const handlePrevImage = () => {
        setSelectedImage(prev =>
            (prev - 1 + (product.additionalImages ? product.additionalImages.length + 1 : 1)) %
            (product.additionalImages ? product.additionalImages.length + 1 : 1)
        );
    };
    const handleAddToCart = async (e) => {
        e.stopPropagation();
        if (!userContext) {
            setShowLoginPrompt(true);
            return;
        }

        setLoading(true);
        try {
            const cartItemsRef = collection(db, "userCart", userContext.uid, "cartItems");

            const querySnapshot = await getDocs(
                query(cartItemsRef, where("productId", "==", product.id))
            );

            if (!querySnapshot.empty) {
                const docSnapshot = querySnapshot.docs[0];
                const currentQuantity = docSnapshot.data().quantity || 1;
                await updateDoc(doc(cartItemsRef, docSnapshot.id), {
                    quantity: currentQuantity + 1,
                    addedAt: serverTimestamp()
                });
            } else {
                await addDoc(cartItemsRef, {
                    productId: product.id,
                    title: product.title,
                    price: product.discountedPrice,
                    image: product.image,
                    quantity: 1,
                    addedAt: serverTimestamp()
                });
            }

            setAdded(true);
            setTimeout(() => setAdded(false), 3000);
        } catch (error) {
            console.error("Error adding to cart: ", error);
        } finally {
            setLoading(false);
        }
    };

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

    const handleBuyNow = (e) => {
        e.stopPropagation();
        if (!userContext) {
            setShowLoginPrompt(true);
            return;
        }
        navigate("/BuyNow", { state: { product } });
    };


    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-pink-500 border-opacity-75"></div>
        </div>
    );

    if (error) return (
        <div className="text-center py-12">
            <div className="max-w-md mx-auto p-4 bg-red-50 rounded-lg">
                <Info className="w-10 h-10 mx-auto text-red-500 mb-2" />
                <p className="text-red-500 text-lg">{error}</p>
            </div>
        </div>
    );

    if (!product) return (
        <div className="text-center py-12">
            <div className="max-w-md mx-auto p-4 bg-gray-50 rounded-lg">
                <X className="w-10 h-10 mx-auto text-gray-500 mb-2" />
                <p className="text-gray-700 text-lg">Product not found</p>
            </div>
        </div>
    );

    const renderAttributes = () => {
        if (!product.attributes || !Array.isArray(product.attributes)) return null;

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {product.attributes.map((attr) => (
                    <div key={attr.id || attr.name} className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium text-gray-700 capitalize">{attr.name}:</span>
                        <span className="ml-2 text-gray-900 font-medium">{attr.value || "N/A"}</span>
                    </div>
                ))}
            </div>
        );
    };


    const renderStockStatus = () => {
        if (!inventory) return null;

        const isLowStock = inventory.stock <= inventory.lowStockThreshold;
        const isOutOfStock = inventory.stock === 0 || !inventory.inStock;

        return (
            <div className={`flex items-center p-3 rounded-lg ${isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-amber-50' : 'bg-green-50'}`}>
                <span className="font-medium mr-2">Availability:</span>
                {isOutOfStock ? (
                    <span className="text-red-600 font-medium">Out of Stock</span>
                ) : isLowStock ? (
                    <span className="text-amber-600 font-medium">Only {inventory.stock} left</span>
                ) : (
                    <span className="text-green-600 font-medium">In Stock ({inventory.stock})</span>
                )}
            </div>
        );
    };



    const renderRatingStars = (rating) => {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        return (
            <div className="flex items-center">
                {[...Array(5)].map((_, i) => {
                    if (i < fullStars) {
                        return <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />;
                    } else if (i === fullStars && hasHalfStar) {
                        return <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />;
                    } else {
                        return <Star key={i} className="w-5 h-5 text-gray-300" />;
                    }
                })}
            </div>
        );
    };

    const renderProductImages = () => {
        const allImages = product.additionalImages
            ? [product.image, ...product.additionalImages]
            : [product.image];

        return (
            <div className="relative group">
                {/* Main Image */}
                <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-2xl bg-gray-100 cursor-zoom-in"
                    onClick={() => setShowFullscreen(true)}>
                    <img
                        src={allImages[selectedImage]}
                        alt={`${product.title} - ${selectedImage + 1}`}
                        className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                </div>

                {/* Navigation Arrows */}
                {allImages.length > 1 && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePrevImage();
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md transition-all"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-800" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleNextImage();
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md transition-all"
                        >
                            <RightIcon className="w-5 h-5 text-gray-800" />
                        </button>
                    </>
                )}

                {/* Thumbnail Scroll */}
                {allImages.length > 1 && (
                    <div className="mt-4 overflow-x-auto pb-2">
                        <div className="flex space-x-3">
                            {allImages.map((img, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleThumbnailClick(index)}
                                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === index ? 'border-pink-500' : 'border-transparent'}`}
                                >
                                    <img
                                        src={img}
                                        alt={`Thumbnail ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };


    // Add fullscreen image viewer
    const renderFullscreenViewer = () => {
        if (!showFullscreen) return null;

        const allImages = product.additionalImages
            ? [product.image, ...product.additionalImages]
            : [product.image];

        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <button
                    onClick={() => setShowFullscreen(false)}
                    className="absolute top-4 right-4 text-white p-2"
                >
                    <X className="w-8 h-8" />
                </button>

                <div className="relative max-w-4xl w-full h-full flex items-center">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePrevImage();
                        }}
                        className="absolute left-4 bg-white/20 hover:bg-white/30 p-3 rounded-full shadow-md transition-all z-10"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </button>

                    <div className="w-full h-full flex items-center justify-center">
                        <img
                            src={allImages[selectedImage]}
                            alt={`${product.title} - ${selectedImage + 1}`}
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleNextImage();
                        }}
                        className="absolute right-4 bg-white/20 hover:bg-white/30 p-3 rounded-full shadow-md transition-all z-10"
                    >
                        <RightIcon className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Thumbnail strip at bottom */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <div className="bg-black/50 rounded-lg p-2">
                        <div className="flex space-x-2 overflow-x-auto max-w-full px-2">
                            {allImages.map((img, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleThumbnailClick(index)}
                                    className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border transition-all ${selectedImage === index ? 'border-pink-500' : 'border-white/30'}`}
                                >
                                    <img
                                        src={img}
                                        alt={`Thumbnail ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };



    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumb */}
            <div className="flex items-center text-sm text-gray-500 mb-6">
                <a href="/" className="hover:text-pink-600">Home</a>
                <ChevronRight className="w-4 h-4 mx-2" />
                {categoryDetails && (
                    <>
                        <a href={`/category/${product.categoryId}`} className="hover:text-pink-600 capitalize">
                            {categoryDetails.name}
                        </a>
                        <ChevronRight className="w-4 h-4 mx-2" />
                    </>
                )}
                <span className="text-gray-700 font-medium">{product.title}</span>
            </div>


            {/* Product Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
                {/* Product Image */}
                <div>
                    {renderProductImages()}
                </div>

                {/* Product Info */}
                <div className="space-y-6">
                    <div>
                        {categoryDetails && (
                            <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full mb-3">
                                {categoryDetails.name}
                            </span>
                        )}
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{product.title}</h1>
                    </div>

                    {/* Rating */}
                    {product.averageRating && (
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center">
                                {renderRatingStars(product.averageRating)}
                                <span className="ml-2 text-gray-600 text-sm">
                                    ({product.reviewCount || 0} reviews)
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Price */}
                    <div className="flex items-baseline space-x-4">
                        <div className="text-3xl font-bold text-pink-600">Rs. {product.discountedPrice}</div>
                        {product.originalPrice && product.originalPrice > product.discountedPrice && (
                            <span className="text-lg text-gray-400 line-through">
                                Rs. {product.originalPrice}
                            </span>
                        )}
                    </div>

                    {/* Stock Status */}
                    {renderStockStatus()}

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button
                            onClick={handleAddToCart}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl transition-all duration-300 
                            ${userRole === "admin" || added || (inventory && inventory.stock === 0 || !inventory.inStock) ?
                                    'bg-gray-200 text-gray-500 cursor-not-allowed' :
                                    'bg-pink-600 text-white hover:bg-pink-700 shadow-lg hover:shadow-pink-200'}`}
                            disabled={added || loadingAddToCart || userRole === "admin" || (inventory && inventory.stock === 0 || !inventory.inStock)}
                        >
                            {loadingAddToCart ? (
                                <>
                                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                    <span>Adding...</span>
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="w-5 h-5" />
                                    {added ? 'Added to Cart' : 'Add to Cart'}
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleBuyNow}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl transition-all duration-300 
                            ${userRole === "admin" || (inventory && inventory.stock === 0 || !inventory.inStock) ?
                                    'bg-gray-100 text-gray-500 border border-gray-300 cursor-not-allowed' :
                                    'bg-white text-gray-900 border border-gray-300 hover:border-pink-500 hover:text-pink-600 shadow-md hover:shadow-pink-100'}`}
                            disabled={userRole === "admin" || (inventory && inventory.stock === 0 || !inventory.inStock)}
                        >
                            <Zap className="w-5 h-5" />
                            Buy Now
                        </button>
                    </div>

                    {/* Trust Badges */}
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                            <Shield className="w-5 h-5 text-pink-600 mr-2" />
                            <span className="text-sm text-gray-700">Secure Checkout</span>
                        </div>
                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                            <svg className="w-5 h-5 text-pink-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-gray-700">Fast Delivery</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Details Sections */}
            <div className="space-y-12">
                {/* Details Section */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                        <span className="w-1 h-6 bg-pink-600 mr-3 rounded-full"></span>
                        Product Details
                    </h2>
                    {renderAttributes()}
                </div>

                {/* Description Section */}
                {product.description && (
                    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                            <span className="w-1 h-6 bg-pink-600 mr-3 rounded-full"></span>
                            Description
                        </h2>
                        <div className="prose max-w-none text-gray-700">
                            {product.description}
                        </div>
                    </div>
                )}

                {/* Care Section */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                        <span className="w-1 h-6 bg-pink-600 mr-3 rounded-full"></span>
                        Care Instructions
                    </h2>
                    <div className="prose max-w-none text-gray-700">
                        <p>Wipe with a slightly damp cloth to clean your product. Do not use any chemical or liquid containing chemicals in the cleaning process.</p>
                    </div>
                </div>

                {/* Disclaimer Section */}
                <div className="bg-amber-50 rounded-2xl p-6 sm:p-8 border border-amber-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                        <span className="w-1 h-6 bg-amber-500 mr-3 rounded-full"></span>
                        Disclaimer
                    </h2>
                    <p className="text-gray-700">
                        Actual colors of the product may vary from the colors being displayed on your device.
                    </p>
                </div>
            </div>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
                <section className="mt-16">
                    <div className="mb-10">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                            {categoryDetails ? `More ${categoryDetails.name}` : "You May Also Like"}
                        </h2>
                        <p className="text-gray-600 max-w-xl">
                            Browse through our curated collection of similar products.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {relatedProducts.map((product) => (
                            <div key={product.id} className="group">
                                <ProductCard product={product} />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Login Prompt Modal */}
            {showLoginPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full relative shadow-xl animate-fade-in">
                        <button
                            onClick={() => setShowLoginPrompt(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-pink-100 mb-4">
                                <ShoppingCart className="h-6 w-6 text-pink-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Login Required</h3>
                            <p className="text-gray-600 mb-6">Please log in to add items to your cart.</p>
                            <button
                                onClick={handleSignIn}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-pink-600 text-white font-medium rounded-lg hover:bg-pink-700 transition-colors shadow-md"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.545 10.239v3.821h5.445c-0.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866 0.549 3.921 1.453l2.814-2.814c-1.784-1.664-4.152-2.675-6.735-2.675-5.522 0-10 4.477-10 10s4.478 10 10 10c8.396 0 10-7.496 10-10 0-0.67-0.069-1.325-0.189-1.961h-9.811z" />
                                </svg>
                                Continue with Google
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {renderFullscreenViewer()}
        </div>
    );
};

export default ProductDetail;