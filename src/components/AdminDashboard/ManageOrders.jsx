import React, { useState, useEffect } from "react";
import {
    collection, getDocs, doc, writeBatch, Timestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft, Search, Filter, Calendar, User, Mail,
    Package, CreditCard, Truck, CheckCircle, XCircle,
    Loader2, MoreVertical, ChevronDown, ChevronUp,
    PackageCheck, PackageX, RefreshCw, AlertTriangle
} from "lucide-react";


function ManageOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [inventory, setInventory] = useState([]);
    const [updatingStock, setUpdatingStock] = useState(null);
    const [stockUpdateStatus, setStockUpdateStatus] = useState(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });

    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch orders
                const ordersCollection = collection(db, "orders");
                const ordersSnapshot = await getDocs(ordersCollection);

                const ordersData = await Promise.all(ordersSnapshot.docs.map(async (doc) => {
                    const orderData = doc.data();
                    // Convert Firestore timestamp to JS Date
                    const createdAt = orderData.createdAt instanceof Timestamp
                        ? orderData.createdAt.toDate()
                        : new Date(orderData.createdAt);

                    return {
                        id: doc.id,
                        ...orderData,
                        createdAt,
                        formattedDate: createdAt.toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                        }),
                        formattedTime: createdAt.toLocaleTimeString('en-US', {
                            hour: '2-digit', minute: '2-digit'
                        })
                    };
                }));

                // Sort by date (newest first)
                ordersData.sort((a, b) => b.createdAt - a.createdAt);

                // Fetch inventory
                const inventoryCollection = collection(db, "inventory");
                const inventorySnapshot = await getDocs(inventoryCollection);
                // In the fetchData function, change the inventory data mapping:
                const inventoryData = inventorySnapshot.docs.map(doc => ({
                    id: doc.id,
                    productId: doc.data().productId,  // Add this line
                    ...doc.data()
                }));

                setOrders(ordersData);
                setFilteredOrders(ordersData);
                setInventory(inventoryData);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to load data. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Apply filters
    useEffect(() => {
        let result = [...orders];

        // Search term filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(order =>
                order.id.toLowerCase().includes(term) ||
                order.userId.toLowerCase().includes(term) ||
                (order.transactionId && order.transactionId.toLowerCase().includes(term))
            );
        }

        // Status filter
        if (statusFilter) {
            result = result.filter(order => order.status === statusFilter);
        }

        // Payment filter
        if (paymentFilter) {
            result = result.filter(order => order.paymentStatus === paymentFilter);
        }

        // Date range filter
        if (dateRange.start || dateRange.end) {
            const startDate = dateRange.start ? new Date(dateRange.start) : null;
            const endDate = dateRange.end ? new Date(dateRange.end) : null;

            if (startDate) {
                startDate.setHours(0, 0, 0, 0);
                result = result.filter(order => order.createdAt >= startDate);
            }

            if (endDate) {
                endDate.setHours(23, 59, 59, 999);
                result = result.filter(order => order.createdAt <= endDate);
            }
        }

        setFilteredOrders(result);
    }, [orders, searchTerm, statusFilter, paymentFilter, dateRange]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'shipped': return 'bg-purple-100 text-purple-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPaymentColor = (status) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800';
            case 'unpaid': return 'bg-yellow-100 text-yellow-800';
            case 'failed': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const handleViewDetails = (orderId) => {
        navigate(`/admin-dashboard/orders/${orderId}`);
    };
    const handleUpdateInventory = async (order) => {
        try {
            setUpdatingStock(order.id);
            setStockUpdateStatus(null);
    
            // Check if order is already processed
            if (order.inventoryUpdated) {
                setStockUpdateStatus({
                    type: 'warning',
                    message: 'Inventory already updated for this order'
                });
                return;
            }
    
            // Check if order is cancelled
            if (order.status === 'cancelled') {
                setStockUpdateStatus({
                    type: 'error',
                    message: 'Cannot update inventory for cancelled orders'
                });
                return;
            }
    
            // Check if order is delivered
            if (order.status === 'delivered') {
                setStockUpdateStatus({
                    type: 'error',
                    message: 'Inventory already deducted for delivered orders'
                });
                return;
            }
    
            // Find inventory items for products in the order
            const batch = writeBatch(db);
            let allItemsAvailable = true;
            const unavailableItems = [];
    
            for (const item of order.items) {
                const inventoryItem = inventory.find(inv => inv.productId === item.productId);
    
                if (!inventoryItem) {
                    allItemsAvailable = false;
                    unavailableItems.push(item.title || `Product ${item.productId}`);
                    continue;
                }
    
                if (inventoryItem.stock < item.quantity) {
                    allItemsAvailable = false;
                    unavailableItems.push(`${item.title} (Available: ${inventoryItem.stock})`);
                    continue;
                }
    
                // Update inventory in batch
                const inventoryRef = doc(db, "inventory", inventoryItem.id);
                batch.update(inventoryRef, {
                    stock: inventoryItem.stock - item.quantity,
                    updatedAt: new Date(),
                    inStock: (inventoryItem.stock - item.quantity) > 0  // Update inStock flag
                });
            }
    
            if (!allItemsAvailable) {
                setStockUpdateStatus({
                    type: 'error',
                    message: `Insufficient stock for: ${unavailableItems.join(', ')}`
                });
                return;
            }
    
            // Mark order as inventory updated
            const orderRef = doc(db, "orders", order.id);
            batch.update(orderRef, {
                inventoryUpdated: true,
                inventoryUpdatedAt: new Date()
            });
    
            // Commit the batch
            await batch.commit();
    
            // Update local state
            const updatedOrders = orders.map(o =>
                o.id === order.id ? { ...o, inventoryUpdated: true } : o
            );
            setOrders(updatedOrders);
    
            // Refresh inventory data
            const inventoryCollection = collection(db, "inventory");
            const inventorySnapshot = await getDocs(inventoryCollection);
            const inventoryData = inventorySnapshot.docs.map(doc => ({
                id: doc.id,
                productId: doc.data().productId,
                ...doc.data()
            }));
            setInventory(inventoryData);
    
            setStockUpdateStatus({
                type: 'success',
                message: 'Inventory updated successfully'
            });
        } catch (err) {
            console.error("Error updating inventory:", err);
            setStockUpdateStatus({
                type: 'error',
                message: 'Failed to update inventory'
            });
        } finally {
            setUpdatingStock(null);
        }
    };

    const handleRestoreInventory = async (order) => {
        try {
            setUpdatingStock(order.id);
            setStockUpdateStatus(null);
    
            // Check if inventory was previously updated for this order
            if (!order.inventoryUpdated) {
                setStockUpdateStatus({
                    type: 'warning',
                    message: 'Inventory was not previously updated for this order'
                });
                return;
            }
    
            // Check if order is already delivered
            if (order.status === 'delivered') {
                setStockUpdateStatus({
                    type: 'error',
                    message: 'Cannot restore inventory for delivered orders'
                });
                return;
            }
    
            // Find inventory items for products in the order
            const batch = writeBatch(db);
    
            for (const item of order.items) {
                const inventoryItem = inventory.find(inv => inv.productId === item.productId);
    
                if (inventoryItem) {
                    // Restore inventory in batch
                    const inventoryRef = doc(db, "inventory", inventoryItem.id);
                    batch.update(inventoryRef, {
                        stock: inventoryItem.stock + item.quantity,
                        updatedAt: new Date(),
                        inStock: true  // Since we're adding stock back, set inStock to true
                    });
                }
            }
    
            // Mark order as inventory not updated
            const orderRef = doc(db, "orders", order.id);
            batch.update(orderRef, {
                inventoryUpdated: false,
                inventoryUpdatedAt: null
            });
    
            // Commit the batch
            await batch.commit();
    
            // Update local state
            const updatedOrders = orders.map(o =>
                o.id === order.id ? { ...o, inventoryUpdated: false } : o
            );
            setOrders(updatedOrders);
    
            // Refresh inventory data
            const inventoryCollection = collection(db, "inventory");
            const inventorySnapshot = await getDocs(inventoryCollection);
            const inventoryData = inventorySnapshot.docs.map(doc => ({
                id: doc.id,
                productId: doc.data().productId,
                ...doc.data()
            }));
            setInventory(inventoryData);
    
            setStockUpdateStatus({
                type: 'success',
                message: 'Inventory restored successfully'
            });
        } catch (err) {
            console.error("Error restoring inventory:", err);
            setStockUpdateStatus({
                type: 'error',
                message: 'Failed to restore inventory'
            });
        } finally {
            setUpdatingStock(null);
        }
    };
    

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="mt-4 text-lg text-gray-600">Loading orders...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-6 max-w-md bg-white rounded-lg shadow-md">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Error loading orders</h3>
                    <p className="mt-2 text-gray-600">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="-mt-[70px] min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={() => navigate(-1)}
                                className="mr-4 p-1 rounded-full hover:bg-gray-100"
                            >
                                <ArrowLeft className="h-5 w-5 text-gray-600" />
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">Order & Inventory Management</h1>
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                {showFilters ? 'Hide Filters' : 'Show Filters'}
                                {showFilters ? (
                                    <ChevronUp className="h-4 w-4 ml-2" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 ml-2" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-11/12 mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search and Filters */}
                <div className="mb-8">
                    <div className="relative rounded-md shadow-sm mb-4 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Search by Order ID, User ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Orders</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Status Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Order Status
                                    </label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="shipped">Shipped</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>

                                {/* Payment Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Payment Status
                                    </label>
                                    <select
                                        value={paymentFilter}
                                        onChange={(e) => setPaymentFilter(e.target.value)}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                    >
                                        <option value="">All Payment Statuses</option>
                                        <option value="paid">Paid</option>
                                        <option value="unpaid">Unpaid</option>
                                        <option value="failed">Failed</option>
                                    </select>
                                </div>

                                {/* Date Range Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date Range
                                    </label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="date"
                                            value={dateRange.start}
                                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                        />
                                        <span className="flex items-center">to</span>
                                        <input
                                            type="date"
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Status Messages */}
                {stockUpdateStatus && (
                    <div className={`mb-4 p-4 rounded-md ${stockUpdateStatus.type === 'success' ? 'bg-green-50 text-green-800' :
                        stockUpdateStatus.type === 'error' ? 'bg-red-50 text-red-800' :
                            'bg-yellow-50 text-yellow-800'
                        }`}>
                        <div className="flex items-center">
                            {stockUpdateStatus.type === 'success' ? (
                                <CheckCircle className="h-5 w-5 mr-2" />
                            ) : stockUpdateStatus.type === 'error' ? (
                                <XCircle className="h-5 w-5 mr-2" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 mr-2" />
                            )}
                            <p>{stockUpdateStatus.message}</p>
                        </div>
                    </div>
                )}

                {/* Orders Table */}
                <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-gray-50 border-b">
                        <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
                            <div className="flex items-center">
                                <Package className="h-6 w-6 text-blue-500" />
                                <span className="ml-2 text-sm font-medium text-gray-500">Total Orders</span>
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">{filteredOrders.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
                            <div className="flex items-center">
                                <CreditCard className="h-6 w-6 text-green-500" />
                                <span className="ml-2 text-sm font-medium text-gray-500">Paid Orders</span>
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">
                                {filteredOrders.filter(o => o.paymentStatus === 'paid').length}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
                            <div className="flex items-center">
                                <Truck className="h-6 w-6 text-purple-500" />
                                <span className="ml-2 text-sm font-medium text-gray-500">Pending Shipment</span>
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">
                                {filteredOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
                            <div className="flex items-center">
                                <PackageCheck className="h-6 w-6 text-indigo-500" />
                                <span className="ml-2 text-sm font-medium text-gray-500">Inventory Processed</span>
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">
                                {filteredOrders.filter(o => o.inventoryUpdated).length}
                            </p>
                        </div>
                    </div>

                    {/* Orders List */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Order ID
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date & Time
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Items
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Payment
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Inventory
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-4 text-center text-sm text-gray-500">
                                            No orders found matching your criteria
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                                #{order.id.substring(0, 8)}...
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center">
                                                    <User className="h-4 w-4 text-gray-400 mr-2" />
                                                    {order.userId.substring(0, 6)}...
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center">
                                                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                                                    {order.formattedDate}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {order.items.length} items
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                ${order.totalPrice.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentColor(order.paymentStatus)}`}>
                                                    {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {order.inventoryUpdated ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        <PackageCheck className="h-3 w-3 mr-1" /> Updated
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        <PackageX className="h-3 w-3 mr-1" /> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        onClick={() => handleViewDetails(order.id)}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        View
                                                    </button>

                                                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                                        <>
                                                            {!order.inventoryUpdated ? (
                                                                <button
                                                                    onClick={() => handleUpdateInventory(order)}
                                                                    disabled={updatingStock === order.id}
                                                                    className="text-green-600 hover:text-green-900 flex items-center"
                                                                >
                                                                    {updatingStock === order.id ? (
                                                                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                                    ) : (
                                                                        <PackageCheck className="h-3 w-3 mr-1" />
                                                                    )}
                                                                    Update Stock
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleRestoreInventory(order)}
                                                                    disabled={updatingStock === order.id}
                                                                    className="text-orange-600 hover:text-orange-900 flex items-center"
                                                                >
                                                                    {updatingStock === order.id ? (
                                                                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                                    ) : (
                                                                        <PackageX className="h-3 w-3 mr-1" />
                                                                    )}
                                                                    Restore Stock
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ManageOrdersPage;