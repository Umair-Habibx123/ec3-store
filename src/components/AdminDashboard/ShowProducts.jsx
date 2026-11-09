import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Edit2, Trash2, Search, Shield, X, Check, RotateCcw, Loader2, Filter } from "lucide-react";
import EditProductModal from "./EditProductModal";

function ShowProducts() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({});
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState("all");
    const [showFilters, setShowFilters] = useState(false);

    // Fetch products, categories, and inventory
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch products
                const productsRef = collection(db, "products");
                const productsSnapshot = await getDocs(productsRef);

                // Fetch categories
                const categoriesRef = collection(db, "categories");
                const categoriesSnapshot = await getDocs(categoriesRef);

                // Fetch inventory
                const inventoryRef = collection(db, "inventory");
                const inventorySnapshot = await getDocs(inventoryRef);

                // Map products with their category names and inventory data
                const productsData = productsSnapshot.docs.map((doc) => {
                    const product = doc.data();
                    const category = categoriesSnapshot.docs.find(c => c.id === product.categoryId);
                    const productInventory = inventorySnapshot.docs.find(i => i.data().productId === doc.id);

                    return {
                        id: doc.id,
                        ...product,
                        isDeleted: product.isDeleted || false,
                        categoryName: category?.data()?.name || 'Unknown',
                        inventory: productInventory?.data() || {
                            inStock: false,
                            stock: 0,
                            lowStockThreshold: 0
                        }
                    };
                });

                setProducts(productsData);
                setCategories(categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setInventory(inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to load products");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Not called at the moment; kept for refreshing the list after an edit.
    // eslint-disable-next-line no-unused-vars
    const fetchProducts = async () => {
        try {
            // Fetch products
            const productsRef = collection(db, "products");
            const productsSnapshot = await getDocs(productsRef);

            // Fetch categories
            const categoriesRef = collection(db, "categories");
            const categoriesSnapshot = await getDocs(categoriesRef);

            // Fetch inventory
            const inventoryRef = collection(db, "inventory");
            const inventorySnapshot = await getDocs(inventoryRef);

            const productsData = productsSnapshot.docs.map((doc) => {
                const product = doc.data();
                const category = categoriesSnapshot.docs.find(c => c.id === product.categoryId);
                const productInventory = inventorySnapshot.docs.find(i => i.data().productId === doc.id);

                return {
                    id: doc.id,
                    ...product,
                    isDeleted: product.isDeleted || false,
                    categoryName: category?.data()?.name || 'Unknown',
                    inventory: productInventory?.data() || {
                        inStock: false,
                        stock: 0,
                        lowStockThreshold: 0
                    }
                };
            });

            setProducts(productsData);
            setCategories(categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setInventory(inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("Failed to load products");
        }
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch =
            product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.categoryName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
            filter === 'all' ||
            (filter === 'active' && !product.isDeleted) ||
            (filter === 'deleted' && product.isDeleted);

        return matchesSearch && matchesStatus;
    });

    const handleRestore = async (productId) => {
        try {
            await updateDoc(doc(db, "products", productId), {
                isDeleted: false
            });

            setProducts(prev =>
                prev.map(p => p.id === productId ? { ...p, isDeleted: false } : p)
            );

            setSuccessMessage("Product restored successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Failed to restore product: " + err.message);
            console.error(err);
        }
    };

    const handleEditClick = (product) => {
        console.log("Edit button clicked for product:", product.id);
        setEditingProduct(product.id);
        setFormData({
            ...product,
            attributes: product.attributes || {},
            additionalImages: product.additionalImages || [],
            // Include inventory data in formData for editing
            inStock: product.inventory?.inStock || false,
            stock: product.inventory?.stock || 0,
            lowStockThreshold: product.inventory?.lowStockThreshold || 0
        });
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name.includes(".")) {
            const [key, subkey] = name.split(".");
            setFormData((prev) => ({
                ...prev,
                [key]: { ...prev[key], [subkey]: type === 'checkbox' ? checked : value },
            }));
        } else if (name === 'additionalImages') {
            setFormData((prev) => ({ ...prev, [name]: value }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleAttributeChange = (index, field, value) => {
        setFormData(prev => {
            const updatedAttributes = [...prev.attributes];
            updatedAttributes[index] = {
                ...updatedAttributes[index],
                [field]: value
            };
            return { ...prev, attributes: updatedAttributes };
        });
    };

    const handleAddAttribute = () => {
        setFormData(prev => ({
            ...prev,
            attributes: [
                ...(prev.attributes || []),
                { id: Date.now().toString(), name: '', value: '' }
            ]
        }));
    };

    const handleRemoveAttribute = (index) => {
        setFormData(prev => {
            const updatedAttributes = [...prev.attributes];
            updatedAttributes.splice(index, 1);
            return { ...prev, attributes: updatedAttributes };
        });
    };

    const handleUpdate = async () => {
        if (!formData.title || !formData.originalPrice || !formData.discountedPrice || !formData.image || !formData.categoryId) {
            setError("Please fill in all required fields");
            return;
        }

        try {
            // Update product data
            const productUpdateData = {
                title: formData.title,
                categoryId: formData.categoryId,
                image: formData.image,
                additionalImages: formData.additionalImages,
                originalPrice: Number(formData.originalPrice),
                discountedPrice: Number(formData.discountedPrice),
                description: formData.description || "",
                attributes: formData.attributes || {},
                createdAt: formData.createdAt || new Date() // Preserve creation date
            };

            await updateDoc(doc(db, "products", editingProduct), productUpdateData);

            // Update inventory data
            const inventoryDocRef = doc(db, "inventory", `${editingProduct}`);
            const inventoryDoc = await getDoc(inventoryDocRef);

            const inventoryUpdateData = {
                productId: editingProduct,
                inStock: formData.inStock || false,
                stock: Number(formData.stock) || 0,
                lowStockThreshold: Number(formData.lowStockThreshold) || 0,
                updatedAt: new Date()
            };

            if (inventoryDoc.exists()) {
                await updateDoc(inventoryDocRef, inventoryUpdateData);
            } else {
                // Create new inventory document if it doesn't exist
                await setDoc(inventoryDocRef, inventoryUpdateData);
            }

            // Update local state
            setProducts(prev =>
                prev.map(p => p.id === editingProduct ? {
                    ...p,
                    ...productUpdateData,
                    inventory: inventoryUpdateData
                } : p)
            );

            setEditingProduct(null);
            setSuccessMessage("Product and inventory updated successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Failed to update product: " + err.message);
            console.error(err);
        }
    };

    const handleDeleteClick = (productId) => {
        setDeleteConfirm(productId);
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const productRef = doc(db, "products", deleteConfirm);
            await updateDoc(productRef, {
                isDeleted: true
            });

            setProducts(prev =>
                prev.map(p => p.id === deleteConfirm ? { ...p, isDeleted: true } : p)
            );

            setSuccessMessage("Product marked as deleted!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error marking product as deleted:", err);
            setError("Failed to delete product: " + err.message);
        } finally {
            setDeleting(false);
            setDeleteConfirm(null);
        }
    };



    return (
        <div className="-mt-[70px] min-h-screen bg-gray-50/50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 shadow-sm">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Product Management</h1>
                                <p className="text-xs text-gray-500">Manage your product inventory</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <div className="relative w-full">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    placeholder="Search by product or category..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm shadow-sm hover:bg-gray-50 transition-colors"
                                >
                                    <Filter className="h-4 w-4" />
                                    <span>Filter</span>
                                </button>

                                {showFilters && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 animate-fade-in">
                                        <div className="p-2">
                                            <div className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => { setFilter('all'); setShowFilters(false); }}>
                                                <input type="radio" checked={filter === 'all'} readOnly className="mr-2" />
                                                <span>All Products</span>
                                            </div>
                                            <div className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => { setFilter('active'); setShowFilters(false); }}>
                                                <input type="radio" checked={filter === 'active'} readOnly className="mr-2" />
                                                <span>Active Only</span>
                                            </div>
                                            <div className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => { setFilter('deleted'); setShowFilters(false); }}>
                                                <input type="radio" checked={filter === 'deleted'} readOnly className="mr-2" />
                                                <span>Deleted Only</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                {successMessage && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2 animate-fade-in">
                        <Check className="h-5 w-5 flex-shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2 animate-fade-in">
                        <X className="h-5 w-5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                        <p className="text-gray-500">Loading products...</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-800">
                                {filter === 'all' ? 'All Products' :
                                    filter === 'active' ? 'Active Products' : 'Deleted Products'}
                                {searchTerm && ' matching search'}
                                <span className="ml-2 text-sm bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">
                                    {filteredProducts.length} items
                                </span>
                            </h2>

                            {filter !== 'all' && (
                                <button
                                    onClick={() => setFilter('all')}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Clear filter
                                </button>
                            )}
                        </div>

                        {filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {filteredProducts.map((product) => (
                                    <div
                                        key={product.id}
                                        className={`relative group rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all overflow-hidden hover:-translate-y-1 ${product.isDeleted
                                            ? "bg-gray-50 opacity-70 cursor-not-allowed"
                                            : "bg-white"
                                            }`}
                                    >
                                        {/* Red cross overlay for deleted products */}
                                        {product.isDeleted && (
                                            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                                                <div className="absolute w-full h-1 bg-red-500 transform rotate-45"></div>
                                                <div className="absolute w-full h-1 bg-red-500 transform -rotate-45"></div>
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="absolute top-3 right-3 flex gap-2 opacity-100 group-hover:opacity-100 transition-opacity z-10">
                                            {!product.isDeleted ? (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditClick(product);
                                                        }}
                                                        className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                        aria-label="Edit product"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(product.id)}
                                                        className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        aria-label="Delete product"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleRestore(product.id)}
                                                    className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-green-50 hover:text-green-600 transition-colors"
                                                    aria-label="Restore product"
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className={`h-48 bg-gray-50 overflow-hidden relative ${product.isDeleted ? "opacity-50" : ""
                                            }`}>
                                            <img
                                                src={product.image || ""}
                                                alt={product.title}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                onError={(e) => {
                                                    e.target.src = "";
                                                }}
                                            />
                                            {product.originalPrice > product.discountedPrice && (
                                                <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                                                    {Math.round((1 - product.discountedPrice / product.originalPrice) * 100)}% OFF
                                                </div>
                                            )}
                                        </div>

                                        <div className={`p-4 ${product.isDeleted ? "opacity-50" : ""}`}>
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className="font-medium text-gray-900 line-clamp-2">
                                                    {product.title}
                                                    {product.isDeleted && (
                                                        <span className="ml-2 text-xs text-red-500">(Deleted)</span>
                                                    )}
                                                </h3>
                                                <div className="flex flex-col items-end shrink-0">
                                                    <span className="font-bold text-indigo-600">
                                                        Rs. {product.discountedPrice.toLocaleString()}
                                                    </span>
                                                    {product.originalPrice > product.discountedPrice && (
                                                        <span className="text-xs text-gray-500 line-through">
                                                            Rs. {product.originalPrice.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between">
                                                <span className={`px-2 py-1 text-xs rounded-full ${product.isDeleted
                                                        ? 'bg-gray-200 text-gray-600'
                                                        : product.inventory.inStock
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {product.isDeleted
                                                        ? 'Deleted'
                                                        : product.inventory.inStock
                                                            ? `In Stock (${product.inventory.stock})`
                                                            : 'Out of Stock'}
                                                </span>
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                                    {product.categoryName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                                <div className="mx-auto h-20 w-20 text-gray-300 mb-4">
                                    <Search className="w-full h-full" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                                <p className="mt-1 text-gray-500 max-w-md mx-auto">
                                    {searchTerm ? "Try a different search term" : "No products available in inventory"}
                                </p>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        Clear search
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-scale-in">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-900">Confirm Deletion</h2>
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="text-gray-400 hover:text-gray-500 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="mb-6">
                                <p className="text-gray-600">
                                    Are you sure you want to delete this product?
                                </p>
                                <p className="mt-2 text-sm text-gray-500">
                                    This will soft delete it. means can be restored.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center gap-2 font-medium"
                                >
                                    {deleting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                    // onClick={() => setEditingProduct(null)}
                    />
                    <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all animate-scale-in">
                        <EditProductModal
                            formData={formData}
                            categories={categories}
                            handleInputChange={handleInputChange}
                            handleAttributeChange={handleAttributeChange}
                            handleAddAttribute={handleAddAttribute}
                            handleRemoveAttribute={handleRemoveAttribute}
                            handleUpdate={handleUpdate}
                            setEditingProduct={setEditingProduct}
                            error={error}
                            // Add inventory specific fields to the modal
                            showInventoryFields={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ShowProducts;