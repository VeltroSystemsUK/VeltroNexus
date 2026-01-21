export { };
console.log("Debugging V2...");
try {
    console.log("Importing storage...");
    await import("./server/storage");
    console.log("Storage imported.");
    console.log("Importing routes...");
    await import("./server/routes");
    console.log("Routes imported.");
} catch (e: any) {
    console.error("ERROR MESSAGE:", e.message);
    console.error("ERROR STACK:", e.stack);
}
