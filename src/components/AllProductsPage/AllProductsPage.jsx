import React, { useState, useEffect } from "react";
import { getDocs, collection } from "firebase/firestore";
import ProductCard from "../ProductCard/ProductCard.jsx";
import { db } from "../../firebase.js";
import { fetchActiveProducts, fetchInventoryMap } from "../../utils/products.js";
import { Search, X, ChevronLeft, ChevronRight, Loader2, Filter } from "lucide-react";

const AllProductsPage = () => {
  const itemsPerPage = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState(null);

  // Define price ranges in Rs
  const priceRanges = [
    { id: 'all', label: 'All Prices', min: null, max: null },
    { id: 'low', label: 'Under RS-500', min: 0, max: 500 },
    { id: 'medium', label: 'RS-500 - RS-2000', min: 500, max: 2000 },
    { id: 'high', label: 'RS-2000 - RS-5000', min: 2000, max: 5000 },
    { id: 'premium', label: 'Over RS-5000', min: 5000, max: null },
  ];


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLoadingCategories(true);

      try {
        // Categories, products and inventory fetched in parallel (3 reads
        // total instead of an inventory getDoc per card).
        const [categoriesSnapshot, productsList, invMap] = await Promise.all([
          getDocs(collection(db, "categories")),
          fetchActiveProducts(),
          fetchInventoryMap(),
        ]);

        const categoriesList = categoriesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCategories(categoriesList.sort((a, b) => a.name.localeCompare(b.name)));

        setProducts(productsList);
        setInventoryMap(invMap);
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setLoading(false);
        setLoadingCategories(false);
      }
    };

    fetchData();
  }, []);



  const filteredProducts = products.filter((product) => {
    // Search term filter
    const matchesSearch = searchTerm
      ? product.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    // Category filter
    const matchesCategory = selectedCategory
      ? product.categoryId === selectedCategory
      : true;

    // Price range filter
    const matchesPrice = !priceRange
      ? true
      : (priceRange.min === null || (product.discountedPrice ?? product.originalPrice) >= priceRange.min) &&
      (priceRange.max === null || (product.discountedPrice ?? product.originalPrice) <= priceRange.max);

    return matchesSearch && matchesCategory && matchesPrice;
  });


  const indexOfLastProduct = currentPage * itemsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - itemsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstProduct,
    indexOfLastProduct
  );

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(selectedCategory === categoryId ? null : categoryId);
    setCurrentPage(1);
    setMobileFiltersOpen(false);
  };

  const getPaginationRange = () => {
    const totalButtons = 5;

    if (totalPages <= totalButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfWay = Math.ceil(totalButtons / 2);

    if (currentPage <= halfWay) {
      return [1, 2, 3, 4, '...', totalPages];
    }

    if (currentPage >= totalPages - halfWay) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  return (
    <section className="bg-gray-50 min-h-screen">
      <div>
        {/* Mobile filter dialog */}
        <div className={`fixed inset-0 z-40 lg:hidden ${mobileFiltersOpen ? 'block' : 'hidden'}`}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex max-w-xs w-full bg-white shadow-xl">
            <div className="w-full h-full overflow-y-auto py-4 px-4 sm:px-6">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                <button
                  type="button"
                  className="-mr-2 flex items-center justify-center rounded-md p-2 text-gray-400 hover:text-gray-500"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Mobile category sidebar */}
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-900">Categories</h3>
                {loadingCategories ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <button
                      onClick={() => handleCategorySelect(null)}
                      className={`flex items-center w-full text-left px-3 py-2 rounded-md text-sm font-medium ${!selectedCategory
                        ? 'bg-purple-100 text-purple-800'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <div className="mr-3 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">
                        <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      All Categories
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`flex items-center w-full text-left px-3 py-2 rounded-md text-sm font-medium ${selectedCategory === category.id
                          ? 'bg-purple-100 text-purple-800'
                          : 'text-gray-600 hover:bg-gray-100'
                          }`}
                      >
                        <div className="mr-3 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 overflow-hidden">
                          {category.image ? (
                            <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                          ) : (
                            <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="container w-full px-4 sm:px-6 py-8 md:py-12">
          <div className="lg:grid lg:grid-cols-5 lg:gap-x-8">
            {/* Desktop sidebar */}
            <div className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Categories</h3>
                  {loadingCategories ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleCategorySelect(null)}
                        className={`flex items-center w-full text-left px-3 py-2 rounded-md text-sm font-medium ${!selectedCategory
                          ? 'bg-purple-100 text-purple-800'
                          : 'text-gray-600 hover:bg-gray-100'
                          }`}
                      >
                        <div className="mr-3 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">
                          <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        All Categories
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleCategorySelect(category.id)}
                          className={`flex items-center w-full text-left px-3 py-2 rounded-md text-sm font-medium ${selectedCategory === category.id
                            ? 'bg-purple-100 text-purple-800'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          <div className="mr-3 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 overflow-hidden">
                            {category.image ? (
                              <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                            ) : (
                              <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          {category.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Price Range (₹)</h3>
                  <div className="space-y-3">
                    {priceRanges.map((range) => (
                      <div key={range.id} className="flex items-center">
                        <input
                          id={`price-range-${range.id}`}
                          name="price-range"
                          type="radio"
                          className="h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
                          checked={
                            (priceRange?.min === range.min && priceRange?.max === range.max) ||
                            (!priceRange && range.id === 'all')
                          }
                          onChange={() => {
                            if (range.id === 'all') {
                              setPriceRange(null);
                            } else {
                              setPriceRange({ min: range.min, max: range.max });
                            }
                            setCurrentPage(1);
                          }}
                        />
                        <label
                          htmlFor={`price-range-${range.id}`}
                          className="ml-3 text-sm text-gray-600"
                        >
                          {range.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Main content */}
            <div className="lg:col-span-4">
              {/* Header and search */}
              <div className="text-center mb-6 md:mb-8">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Discover Our Collection
                </h1>
                <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
                  Explore our wide range of premium products
                </p>
              </div>

              {/* Mobile filter button and product count */}
              <div className="flex items-center justify-between mb-4 lg:hidden">
                <button
                  type="button"
                  className="flex items-center gap-x-2 text-sm font-medium text-gray-700 hover:text-purple-600 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-200"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </button>
                <div className="text-xs sm:text-sm text-gray-500">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-6 md:mb-8 max-w-2xl mx-auto px-2 sm:px-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search products by name or description..."
                    className="block w-full pl-10 pr-10 py-2 sm:py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm sm:text-base"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category indicator */}
              {selectedCategory && (
                <div className="mb-4 md:mb-6 flex items-center px-2 sm:px-0">
                  <span className="text-xs sm:text-sm text-gray-500 mr-2">Filtered by:</span>
                  <div className="inline-flex items-center bg-purple-50 rounded-full py-1 px-3">
                    <div className="mr-2 flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-white overflow-hidden">
                      {categories.find(c => c.id === selectedCategory)?.image ? (
                        <img
                          src={categories.find(c => c.id === selectedCategory).image}
                          alt={categories.find(c => c.id === selectedCategory).name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <svg className="h-3 w-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-purple-600">
                      {categories.find(c => c.id === selectedCategory)?.name}
                    </span>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="ml-2 text-xs sm:text-sm text-purple-400 hover:text-purple-600"
                    >
                      <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredProducts.length === 0 && !loading && (
                <div className="text-center py-12 md:py-16">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-4">
                    <Search className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">
                    No products found
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    {searchTerm
                      ? `We couldn't find any products matching "${searchTerm}". Try different keywords.`
                      : "No products available in this category. Check back later!"}
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex justify-center items-center py-16 md:py-24">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 text-purple-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Loading products...</p>
                  </div>
                </div>
              )}

              {/* Products Grid */}
              {!loading && filteredProducts.length > 0 && (
                <>
                  <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-6">
                    {currentProducts.map((product) => (
                      <div
                        key={product.id}
                        className="group transition-all duration-300 hover:-translate-y-1 px-2 sm:px-0"
                      >
                        <ProductCard product={product} inventoryData={inventoryMap[product.id] ?? null} />
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-10 flex items-center justify-between border-t border-gray-200 pt-6">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => paginate(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === 1
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          Previous
                        </button>
                        <div className="flex items-center justify-center px-4">
                          <span className="text-sm text-gray-700">
                            Page {currentPage} of {totalPages}
                          </span>
                        </div>
                        <button
                          onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === totalPages
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">{indexOfFirstProduct + 1}</span> to{' '}
                            <span className="font-medium">
                              {Math.min(indexOfLastProduct, filteredProducts.length)}
                            </span>{' '}
                            of <span className="font-medium">{filteredProducts.length}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                              onClick={() => paginate(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                              <span className="sr-only">Previous</span>
                              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                            </button>

                            {getPaginationRange().map((pageNumber, index) => (
                              <React.Fragment key={index}>
                                {pageNumber === '...' ? (
                                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                    ...
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => paginate(pageNumber)}
                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === pageNumber
                                      ? "z-10 bg-purple-50 border-purple-500 text-purple-600"
                                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                      }`}
                                  >
                                    {pageNumber}
                                  </button>
                                )}
                              </React.Fragment>
                            ))}

                            <button
                              onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                              <span className="sr-only">Next</span>
                              <ChevronRight className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section >
  );
};

export default AllProductsPage;