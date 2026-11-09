import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { uploadImageToCloudinary } from "../../utils/imageUpload";
import {
    Plus,
    X,
    Image as ImageIcon,
    UploadCloud,
    Check,
    ArrowLeft,
    ChevronDown,
    Info
} from 'lucide-react';


function AddProduct() {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [newCategory, setNewCategory] = useState({
        name: "",
        description: "",
        image: "",
    });
    const [categoryUploadProgress, setCategoryUploadProgress] = useState(0);

    const [showNewCategory, setShowNewCategory] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        categoryId: "",
        originalPrice: 0,
        discountedPrice: 0,
        image: "",
        additionalImages: [],
        description: "",
        attributes: [], // Make sure this is an array
        inStock: true,
        totalStock: 0,
    });
    const [, setCurrentImage] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            const categoriesRef = collection(db, "categories");
            const snapshot = await getDocs(categoriesRef);
            const categoriesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCategories(categoriesList);
        };
        fetchCategories();
    }, []);


    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith("attributes.")) {
            const attributeKey = name.split(".")[1];
            setFormData(prev => ({
                ...prev,
                attributes: {
                    ...prev.attributes,
                    [attributeKey]: value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };


    const handleCategoryImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setLoading(true);
            e.target.value = '';

            const { url } = await uploadImageToCloudinary(
                file,
                (progress) => {
                    setCategoryUploadProgress(progress);
                },
                'category'
            );

            setNewCategory(prev => ({
                ...prev,
                image: url
            }));
            setCurrentImage("");
        } catch (err) {
            setError("Failed to upload category image");
            console.error(err);
        } finally {
            setLoading(false);
            setCategoryUploadProgress(0);
        }
    };


    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setLoading(true);
            const { url } = await uploadImageToCloudinary(
                file,
                (progress) => {
                    setUploadProgress(progress);
                },
                'product'
            );
            setFormData(prev => ({ ...prev, image: url }));
            setCurrentImage("");
        } catch (err) {
            setError("Failed to upload image");
            console.error(err);
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };


    const handleAdditionalImagesUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
    
        try {
            setLoading(true);
            // Reset input value
            e.target.value = '';
            
            const uploadPromises = files.map(file =>
                uploadImageToCloudinary(
                    file,
                    (progress) => {
                        setUploadProgress(progress);
                    },
                    'product'
                )
            );
            const newImages = await Promise.all(uploadPromises);
            setFormData(prev => ({
                ...prev,
                additionalImages: [...prev.additionalImages, ...newImages.map(img => img.url)]
            }));
        } catch (err) {
            setError("Failed to upload some images");
            console.error(err);
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };


    const handleAddCategory = async () => {
        if (loading) return;
    
        if (!newCategory.name.trim()) {
            setError("Category name cannot be empty");
            return;
        }
    
        if (categories.some(cat => cat.name === newCategory.name)) {
            setError("Category already exists");
            return;
        }
    
        try {
            setLoading(true);
            setError("");
    
            const imageUrl = newCategory.image || "";
    
            const newCategoryRef = await addDoc(collection(db, "categories"), {
                name: newCategory.name.trim(),
                description: newCategory.description.trim(),
                image: imageUrl, // Use the URL directly
                createdAt: new Date(),
                updatedAt: new Date()
            });
    
            setCategories(prev => [...prev, {
                id: newCategoryRef.id,
                name: newCategory.name.trim(),
                description: newCategory.description.trim(),
                image: imageUrl
            }]);
    
            setSelectedCategory(newCategoryRef.id);
            setFormData(prev => ({ ...prev, categoryId: newCategoryRef.id }));
            setNewCategory({
                name: "",
                description: "",
                image: "",
                imageFile: null
            });
            setShowNewCategory(false);
            setSuccess("Category added successfully");
        } catch (err) {
            setError("Failed to add category: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
            setCategoryUploadProgress(0);
        }
    };



    const handleAddProduct = async () => {
        if (!formData.title || !formData.categoryId || !formData.image) {
            setError("Please fill all required fields");
            return;
        }

        // Validate prices
        if (formData.discountedPrice > formData.originalPrice) {
            setError("Discounted price cannot be higher than original price");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setSuccess("");

            // Create product document with all required fields
            const productData = {
                title: formData.title,
                isDeleted: false,
                categoryId: formData.categoryId,
                image: formData.image,
                additionalImages: formData.additionalImages,
                originalPrice: Number(formData.originalPrice),
                discountedPrice: Number(formData.discountedPrice),
                description: formData.description,
                attributes: formData.attributes,
                createdAt: new Date(),
                averageRating: 0,
                reviewCount: 0,
                updatedAt: new Date()
            };

            const newProductRef = await addDoc(collection(db, "products"), productData);

            const inventoryData = {
                productId: newProductRef.id,
                stock: Number(formData.totalStock),
                inStock: formData.inStock,
                lowStockThreshold: 5, 
                updatedAt: new Date(),
                warehouseLocation: ""
            };

            await setDoc(doc(db, "inventory", newProductRef.id), inventoryData);

            setSuccess(`Product added successfully with ID: ${newProductRef.id}`);
            resetForm();
        } catch (err) {
            setError("Failed to add product");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    const resetForm = () => {
        setFormData({
            title: "",
            categoryId: "",
            originalPrice: 0,
            discountedPrice: 0,
            image: "",
            additionalImages: [],
            description: "",
            attributes: [],
            inStock: true,
            totalStock: 0,
        });
        setSelectedCategory("");
    };

    return (
        <div className="-mt-[70px] min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.history.back()} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                Add New Product
                            </h1>
                            <p className="text-blue-100 flex items-center gap-1 text-sm mt-1">
                                <Info size={14} />
                                Fill in the product details below
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    {/* Status Messages */}
                    <div className="space-y-3">
                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 animate-fadeIn">
                                <X size={18} className="mt-0.5 flex-shrink-0" />
                                <div>{error}</div>
                            </div>
                        )}
                        {success && (
                            <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 animate-fadeIn">
                                <Check size={18} className="mt-0.5 flex-shrink-0" />
                                <div>{success}</div>
                            </div>
                        )}
                    </div>

                    {/* Category Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                Category
                            </h2>
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setFormData(prev => ({
                                            ...prev,
                                            categoryId: e.target.value
                                        }));
                                    }}
                                    className="w-full appearance-none border border-gray-300 p-2.5 pr-8 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    disabled={showNewCategory}
                                >
                                    <option value="">Select a category</option>
                                    {categories.map(category => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                            </div>
                            <button
                                onClick={() => setShowNewCategory(!showNewCategory)}
                                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium"
                            >
                                {showNewCategory ? (
                                    <>
                                        <X size={16} /> Cancel
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} /> New Category
                                    </>
                                )}
                            </button>
                        </div>

                        {/* New Category Form */}
                        {showNewCategory && (
                            <div className="mt-4 p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Category Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newCategory.name}
                                            onChange={(e) => setNewCategory(prev => ({
                                                ...prev,
                                                name: e.target.value
                                            }))}
                                            placeholder="e.g., Electronics"
                                            className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Category Description
                                        </label>
                                        <input
                                            type="text"
                                            value={newCategory.description}
                                            onChange={(e) => setNewCategory(prev => ({
                                                ...prev,
                                                description: e.target.value
                                            }))}
                                            placeholder="Brief description"
                                            className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Category Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Category Image
                                    </label>
                                    {newCategory.image ? (
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <img
                                                    src={newCategory.image}
                                                    alt="Category preview"
                                                    className="h-24 w-24 object-cover rounded-lg border border-gray-200"
                                                />
                                                <button
                                                    onClick={() => setNewCategory(prev => ({
                                                        ...prev,
                                                        image: "",
                                                        imageFile: null
                                                    }))}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center hover:border-blue-400 transition-colors">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleCategoryImageUpload}
                                                className="hidden"
                                                id="categoryImageUpload"
                                            />
                                            <label
                                                htmlFor="categoryImageUpload"
                                                className="cursor-pointer block"
                                            >
                                                <div className="flex flex-col items-center justify-center space-y-2">
                                                    <UploadCloud size={24} className="text-gray-400" />
                                                    <p className="text-sm text-gray-600">
                                                        Upload category image (optional)
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Recommended size: 500x500px
                                                    </p>
                                                </div>
                                            </label>
                                            {categoryUploadProgress > 0 && (
                                                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-600 h-2 rounded-full"
                                                        style={{ width: `${categoryUploadProgress}%` }}
                                                    ></div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => setShowNewCategory(false)}
                                        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        <X size={16} /> Cancel
                                    </button>
                                    <button
                                        onClick={handleAddCategory}
                                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                                        disabled={loading || !newCategory.name.trim()}
                                    >
                                        {loading ? (
                                            'Adding...'
                                        ) : (
                                            <>
                                                <Plus size={16} /> Add Category
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Product Information Section */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-gray-800">
                            Product Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Product Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={categories.find(c => c.id === formData.categoryId)?.name || ""}
                                    className="w-full border border-gray-300 p-2.5 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    readOnly
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Original Price <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        name="originalPrice"
                                        value={formData.originalPrice}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-300 p-2.5 pl-8 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        min="0"
                                        step="1"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Discounted Price <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        name="discountedPrice"
                                        value={formData.discountedPrice}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-300 p-2.5 pl-8 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        min="0"
                                        step="1"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Total Stock <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="totalStock"
                                    value={formData.totalStock}
                                    onChange={handleInputChange}
                                    className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    min="0"
                                    required
                                />
                            </div>

                            <div className="flex items-center pt-6">
                                <input
                                    type="checkbox"
                                    name="inStock"
                                    checked={formData.inStock}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        inStock: e.target.checked
                                    }))}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                />
                                <label className="ml-2 text-sm font-medium text-gray-700">
                                    In Stock
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Image Upload Sections */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-gray-800">
                            Product Images
                        </h2>

                        {/* Main Image */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Main Image <span className="text-red-500">*</span>
                            </label>
                            {formData.image ? (
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img
                                            src={formData.image}
                                            alt="Product preview"
                                            className="h-28 w-28 object-cover rounded-lg border border-gray-200"
                                        />
                                        <button
                                            onClick={() => setFormData(prev => ({ ...prev, image: "" }))}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center hover:border-blue-400 transition-colors">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        id="mainImageUpload"
                                    />
                                    <label
                                        htmlFor="mainImageUpload"
                                        className="cursor-pointer block"
                                    >
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <UploadCloud size={24} className="text-gray-400" />
                                            <p className="text-sm text-gray-600">
                                                Click to upload main product image
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Recommended size: 800x800px
                                            </p>
                                        </div>
                                    </label>
                                    {uploadProgress > 0 && (
                                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Additional Images */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Additional Images
                            </label>
                            <div className="flex flex-wrap gap-3 mb-3">
                                {formData.additionalImages.map((img, index) => (
                                    <div key={index} className="relative">
                                        <img
                                            src={img}
                                            alt={`Additional ${index + 1}`}
                                            className="h-28 w-28 object-cover rounded-lg border border-gray-200"
                                        />
                                        <button
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                additionalImages: prev.additionalImages.filter((_, i) => i !== index)
                                            }))}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleAdditionalImagesUpload}
                                multiple
                                className="hidden"
                                id="additionalImagesUpload"
                            />
                            <label
                                htmlFor="additionalImagesUpload"
                                className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-lg cursor-pointer transition-colors text-sm font-medium"
                            >
                                <Plus size={16} /> Add More Images
                            </label>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows={5}
                            className="resize-none w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    {/* Attributes */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800">
                                Product Attributes
                            </h2>
                            <button
                                onClick={() => setFormData(prev => ({
                                    ...prev,
                                    attributes: [
                                        ...prev.attributes,
                                        { id: Date.now(), name: '', value: '' }, // unique stable id
                                    ]
                                }))}
                                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                            >
                                <Plus size={16} /> Add Attribute
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {formData.attributes.map((attr, index) => (
                                <div key={attr.id} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={attr.name}
                                        onChange={(e) => {
                                            const updated = [...formData.attributes];
                                            updated[index].name = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                attributes: updated
                                            }));
                                        }}
                                        className="flex-1 border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Attribute name"
                                    />
                                    <input
                                        type="text"
                                        value={attr.value}
                                        onChange={(e) => {
                                            const updated = [...formData.attributes];
                                            updated[index].value = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                attributes: updated
                                            }));
                                        }}
                                        className="flex-1 border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Attribute value"
                                    />
                                    <button
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                attributes: prev.attributes.filter((_, i) => i !== index)
                                            }));
                                        }}
                                        className="text-red-500 hover:text-red-700 p-1.5"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}

                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleAddProduct}
                            disabled={loading || !formData.categoryId}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white ${loading || !formData.categoryId
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                                } transition-colors`}
                        >
                            {loading ? (
                                'Adding Product...'
                            ) : (
                                <>
                                    <Plus size={18} /> Add Product
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AddProduct;