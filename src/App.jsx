import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import { UserProvider } from "./context/UserContext"

import Navbar from './components/Navbar/Navbar'
import Footer from "./components/footer/footer"
import Hero from "./components/Hero/Hero"
import ProtectedRoute from './context/ProtectedRoute'
import LoadingSpinner from './utils/LoadingSpinner'
import { MessageCircle } from 'lucide-react'
import "./App.css"

// Route components are lazy-loaded so each page ships as its own chunk instead
// of one ~1.3 MB bundle — much faster first paint.
const AllProductsPage = lazy(() => import("./components/AllProductsPage/AllProductsPage"))
const ProductDetail = lazy(() => import("./components/ProductCard/productDetails"))
const ProductsSection = lazy(() => import("./components/ProductCard/ProductsSection"))
const CartPage = lazy(() => import('./components/CartPage/cartpage'))
const ContactUsForm = lazy(() => import('./components/ContactPage/contactus'))
const CheckoutPage = lazy(() => import('./components/checkoutPage/checkout_page'))
const SettingsPage = lazy(() => import('./components/Settings/setting'))
const UserDetails = lazy(() => import('./components/Settings/UserDetails'))
const AddAddressPage = lazy(() => import('./components/Settings/AddAddressPage'))
const BuyNowPage = lazy(() => import('./components/BuyNow/BuyNowPage'))
const MyOrdersPage = lazy(() => import('./components/MyOrders/myorders'))
const OrderDetailsPage = lazy(() => import('./components/MyOrders/orderdetails.jsx'))
const OrderConfirmationPage = lazy(() => import('./components/OrderConfirmation/OrderConfirmationPage'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard/AdminDashboard'))
const ShowUsers = lazy(() => import('./components/AdminDashboard/ShowUsers'))
const Forbidden = lazy(() => import('./components/AdminDashboard/Forbidden'))
const EditUsers = lazy(() => import('./components/AdminDashboard/EditUsers'))
const ShowProducts = lazy(() => import('./components/AdminDashboard/ShowProducts'))
const AddNewProduct = lazy(() => import('./components/AdminDashboard/AddProduct.jsx'))
const ManageOrders = lazy(() => import('./components/AdminDashboard/ManageOrders'))
const OrderDetailPage = lazy(() => import('./components/AdminDashboard/OrderDetailPage'))
const ReturnsPolicy = lazy(() => import('./components/footer/return-refund-info'))
const ShippingPolicy = lazy(() => import('./components/footer/shipping-info'))
const AboutUs = lazy(() => import('./components/footer/aboutUs'))
const PageNotFound = lazy(() => import('./components/PageNotFound/PageNotFound'))


function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function App() {
  return (
    <UserProvider>
      <Router>
        <div className="min-h-screen">
          <Navbar />
          <ScrollToTop />
          <div className="main-content">
            <Suspense fallback={<LoadingSpinner size="xl" />}>
              <Routes>
                {/* Home Page */}
                <Route path="/" element={
                  <>
                    <Hero />
                    <ProductsSection />
                  </>
                } />

                {/* All Products Page */}
                <Route path="/all-products" element={<AllProductsPage />} />

                {/* Product Detail Page */}
                <Route path="/product/:id" element={<ProductDetail />} />

                {/* Cart Page */}
                <Route path="/my-cart" element={<CartPage />} />

                {/* Contact Us Page */}
                <Route path="/contact-us" element={<ContactUsForm />} />

                {/* Checkout Page */}
                <Route path="/checkout" element={<CheckoutPage />} />

                {/* Settings Page */}
                <Route path="/setting" element={<SettingsPage />} />

                <Route path="/return-policy" element={<ReturnsPolicy />} />
                <Route path="/shipping-policy" element={<ShippingPolicy />} />

                <Route path="/about-us" element={<AboutUs />} />

                {/* User Profile Page */}
                <Route path="/viewProfile" element={<UserDetails />} />

                {/* Add Address Page */}
                <Route path="/add-address" element={<AddAddressPage />} />

                {/* Buy Now Page */}
                <Route path="/BuyNow" element={<BuyNowPage />} />

                {/* My Orders Page */}
                <Route path="/MyOrders" element={<MyOrdersPage />} />
                <Route path="/OrderDetails/:orderId" element={<OrderDetailsPage />} />

                {/* Order Confirmation Page */}
                <Route path="/order-confirmation" element={<OrderConfirmationPage />} />

                {/* Admin Dashboard and Related Routes */}
                <Route path="/admin-dashboard/*" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/admin-dashboard/showUsers" element={
                  <ProtectedRoute requiredRole="admin">
                    <ShowUsers />
                  </ProtectedRoute>
                } />

                <Route path="/admin-dashboard/showProducts" element={
                  <ProtectedRoute requiredRole="admin">
                    <ShowProducts />
                  </ProtectedRoute>
                } />

                <Route
                  path="/admin-dashboard/manageOrders"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <ManageOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin-dashboard/orders/:orderId"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <OrderDetailPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="/admin-dashboard/editUsers" element={
                  <ProtectedRoute requiredRole="admin">
                    <EditUsers />
                  </ProtectedRoute>
                } />

                <Route path="/admin-dashboard/addNewProducts" element={
                  <ProtectedRoute requiredRole="admin">
                    <AddNewProduct />
                  </ProtectedRoute>
                } />

                {/* Catch-all for Forbidden access */}
                <Route path="/forbidden" element={<Forbidden />} />
                {/* Catch-all for non-matching routes */}
                <Route path="*" element={<PageNotFound />} />

              </Routes>
            </Suspense>
          </div>
          <Footer />

          {/* WhatsApp Floating Button */}
          <div className="fixed bottom-6 right-6 z-[1000]">
            <a
              href="https://wa.me/+923108026280"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
              aria-label="Chat on WhatsApp"
            >
              <MessageCircle className="w-7 h-7 fill-current" />
            </a>
          </div>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
