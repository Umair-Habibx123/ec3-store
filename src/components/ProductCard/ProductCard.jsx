import React, { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, query, where, doc, setDoc, getDoc, getDocs, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/UserContext";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Zap, ChevronRight, X, LogIn, Check, Star, Heart } from "lucide-react";
import LoadingSpinner from "../../utils/LoadingSpinner.jsx";

// `inventoryData` is supplied by the parent list (batched single read). When
// absent (standalone usage), the card fetches its own inventory as a fallback.
const ProductCard = ({ product, inventoryData }) => {
  const [inventory, setInventory] = useState(
    inventoryData
      ? { ...inventoryData, loading: false }
      : { inStock: false, stock: 0, lowStockThreshold: 0, loading: !inventoryData && inventoryData !== null }
  );
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [added, setAdded] = useState(false);
  const { user: userContext, role: userRole } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false); // Added for wishlist

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);
  const provider = new GoogleAuthProvider();
  const navigate = useNavigate();

  const hoverImage = product.additionalImages?.length > 0
    ? product.additionalImages[0]
    : product.image;

  const discountPercentage = Math.round(
    ((product.originalPrice - product.discountedPrice) / product.originalPrice) * 100
  );

  // Role comes from auth context now (no per-card user-doc read).

  // If the parent supplied inventory (batched read), just sync it. Otherwise
  // fall back to fetching this product's inventory doc on its own.
  useEffect(() => {
    if (inventoryData !== undefined) {
      setInventory({
        inStock: false,
        stock: 0,
        lowStockThreshold: 0,
        ...(inventoryData || {}),
        loading: false,
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "inventory", product.id));
        if (cancelled) return;
        setInventory({
          inStock: false,
          stock: 0,
          lowStockThreshold: 0,
          ...(snap.exists() ? snap.data() : {}),
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching inventory:", error);
        if (!cancelled) {
          setInventory({ inStock: false, stock: 0, lowStockThreshold: 0, loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inventoryData, product.id]);


  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (!userContext) {
      setShowLoginPrompt(true);
      return;
    }
  
    setIsLoading(true);
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
      console.error("Error adding to cart:", error);
      if (error.code === 'permission-denied') {
        alert("You don't have permission to add to cart. Please check your account.");
      } else {
        alert("Failed to add item to cart. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };




  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // Create the user profile on first sign-in. Role/profile then flow from
      // the auth context after reload.
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          username: user.displayName,
          profilePic: user.photoURL || "/default-profile.png",
          role: "user",
          address: "",
          createdAt: serverTimestamp(),
        });
      }

      window.location.reload();
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

  const handleCardClick = () => {
    navigate(`/product/${product.id}`, { state: { product } });
  };

  const toggleWishlist = async (e) => {
    e.stopPropagation();
    if (!userContext) {
      setShowLoginPrompt(true);
      return;
    }

    setWishlistLoading(true);
    try {
      // Simulate API call for wishlist toggle
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsWishlisted(!isWishlisted);
    } catch (error) {
      console.error("Error updating wishlist:", error);
    } finally {
      setWishlistLoading(false);
    }
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="relative group overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200">
      {/* Product Image with Hover Effect */}
      <div
        className="relative aspect-square overflow-hidden cursor-pointer"
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={isHovered ? hoverImage : product.image}
          alt={product.title}
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
        />

        {/* Wishlist Button with Loading */}
        <button
          onClick={toggleWishlist}
          disabled={wishlistLoading}
          className={`absolute top-3 left-3 p-2 rounded-full transition-all ${isWishlisted ? 'text-red-500 bg-white/90' : 'text-gray-400 bg-white/80 hover:bg-white/90'} ${wishlistLoading ? 'opacity-70' : ''}`}
        >
          {wishlistLoading ? (
            <LoadingSpinner size={18} className="text-current" />
          ) : (
            <Heart
              size={18}
              fill={isWishlisted ? "currentColor" : "none"}
              strokeWidth={isWishlisted ? 2 : 1.5}
            />
          )}
        </button>

        {/* Discount Badge */}
        <div className="absolute top-3 right-3 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center shadow-md">
          <span>{discountPercentage}% OFF</span>
        </div>



        {/* Stock Status with Loading */}
        {inventory.loading ? (
          <div className="absolute bottom-3 left-3 bg-gray-800/90 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
            <LoadingSpinner size={12} className="mr-1" />
            Checking stock...
          </div>
        ) : !inventory.inStock ? (
          <div className="absolute bottom-3 left-3 bg-gray-800/90 text-white text-xs font-medium px-2.5 py-1 rounded-full">
            Out of Stock
          </div>
        ) : null}

        {/* Quick View Button */}
        {isHovered && (
          <div
            className="absolute inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-opacity-5 transition-all duration-300 cursor-pointer"
            onClick={handleCardClick}
          >
            <div className="bg-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 shadow-md hover:bg-gray-50 transition-colors">
              Quick View <ChevronRight size={16} />
            </div>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 flex flex-col">
        <div className="flex items-center mb-1">
          {product.averageRating > 0 && (
            <div className="flex items-center bg-blue-50 px-2 py-1 rounded-md mr-2">
              <Star size={14} className="fill-yellow-400 text-yellow-400 mr-1" />
              <span className="text-xs font-medium text-gray-800">
                {product.averageRating.toFixed(1)}
              </span>
            </div>
          )}
          {product.reviewCount > 0 && (
            <span className="text-xs text-gray-500">
              ({product.reviewCount})
            </span>
          )}
        </div>

        <h3
          className="font-medium text-gray-900 mb-1 line-clamp-2 h-12 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={handleCardClick}
        >
          {product.title}
        </h3>

        <div className="flex items-end gap-2 mb-3">
          <span className="text-lg font-bold text-gray-900">
            Rs. {product.discountedPrice.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500 line-through mb-0.5">
            Rs. {product.originalPrice.toLocaleString()}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleAddToCart}
            disabled={isLoading || added || isAdmin || !inventory.inStock || inventory.loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${isAdmin
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : !inventory.inStock || inventory.loading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size={16} className="text-current" />
                Adding...
              </>
            ) : added ? (
              <>
                <Check size={16} />
                Added
              </>
            ) : (
              <>
                <ShoppingCart size={16} />
                Add
              </>
            )}
          </button>

          <button
            onClick={handleBuyNow}
            disabled={isAdmin || !inventory.inStock || inventory.loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${isAdmin || !inventory.inStock || inventory.loading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 hover:shadow-md"
              }`}
          >
            <Zap size={16} className="fill-white" />
            Buy Now
          </button>
        </div>
      </div>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-fadeIn shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sign In Required</h3>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              Sign in to add items to your cart and enjoy a seamless shopping experience.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Continue Browsing
              </button>
              <button
                onClick={() => {
                  setShowLoginPrompt(false);
                  handleSignIn();
                }}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <LogIn size={16} />
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Added to Cart Notification */}
      {added && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 flex items-center bg-green-500 text-white px-4 py-2.5 rounded-lg shadow-lg animate-slideDown">
          <div className="bg-white/20 p-1 rounded-full mr-2">
            <Check size={18} />
          </div>
          <span className="font-medium">Added to your cart!</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(ProductCard);