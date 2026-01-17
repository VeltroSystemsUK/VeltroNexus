
// Helper function to format officer name from "SURNAME, First Middle" to "First Middle Surname"
export function formatOfficerName(name: string): string {
    if (!name) return name;

    // Check if name contains a comma (Companies House format: "SURNAME, First Middle")
    if (name.includes(",")) {
        const parts = name.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
            const surname = parts[0];
            const firstNames = parts.slice(1).join(" ");
            // Convert to proper case
            const formatWord = (word: string) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

            const formattedSurname = surname
                .split(/[\s-]+/)
                .map(formatWord)
                .join(surname.includes("-") ? "-" : " ");
            const formattedFirstNames = firstNames.split(/\s+/).map(formatWord).join(" ");

            return `${formattedFirstNames} ${formattedSurname}`.trim();
        }
    }
    return name;
}
