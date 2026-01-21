export { };
console.log("Debugging server files...");
try {
    console.log("Importing storage...");
    await import("./server/storage");
    console.log("Storage imported.");
    console.log("Importing routes...");
    await import("./server/routes");
    console.log("Routes imported.");
} catch (e) {
    console.error("DEBUG ERROR:", e);
}
