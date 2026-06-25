import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/** Fetch all non-deleted products, sorted by numeric id descending. */
export async function fetchActiveProducts() {
    const snap = await getDocs(collection(db, "products"));
    return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((p) => p.isDeleted !== true)
        .sort((a, b) => {
            const idA = parseInt(a.id.replace(/[^0-9]/g, ""), 10) || 0;
            const idB = parseInt(b.id.replace(/[^0-9]/g, ""), 10) || 0;
            return idB - idA;
        });
}

/**
 * Fetch the entire inventory collection once and return a map keyed by
 * productId. This replaces the previous per-card getDoc (an N+1 query that
 * made every ProductCard sit on "Checking stock...").
 */
export async function fetchInventoryMap() {
    const snap = await getDocs(collection(db, "inventory"));
    const map = {};
    for (const doc of snap.docs) {
        const data = doc.data();
        // inventory docs are keyed by productId (per DB struct); fall back to a
        // productId field if present.
        map[data.productId || doc.id] = data;
    }
    return map;
}

/** Default inventory shape when a product has no inventory doc. */
export const EMPTY_INVENTORY = {
    inStock: false,
    stock: 0,
    lowStockThreshold: 0,
};
