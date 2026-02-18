
import { Company } from "../types";
import { db } from "./firebase";
import { collection, getDocs, serverTimestamp, setDoc, doc } from "firebase/firestore";

const CLOUD_FUNCTION_BASE_URL = 'https://REPLACE_WITH_YOUR_REGION-REPLACE_WITH_YOUR_PROJECT.cloudfunctions.net';

export class CompanyRegistryService {
  private collectionRef = collection(db, "verified_entities");
  private isConfigured = !CLOUD_FUNCTION_BASE_URL.includes('REPLACE_WITH');
  private isFirebaseConfigured = !doc(db, 'test', 'test').path.includes('REPLACE_WITH');

  async searchCompany(query: string): Promise<Company[]> {
    if (!this.isConfigured) {
      console.log("Registry: Simulation Mode (Using mock data)");
      await new Promise(r => setTimeout(r, 800));
      return [{
        companyNumber: "08247514",
        companyName: query.toUpperCase() + " (SIMULATED)",
        companyStatus: "active",
        incorporationDate: "2012-10-12",
        registeredAddress: {
          addressLine1: "124 City Road",
          locality: "London",
          postalCode: "EC1V 2NX"
        },
        sicCodes: ["64990"],
        riskLevel: "low"
      }];
    }

    try {
      const response = await fetch(`${CLOUD_FUNCTION_BASE_URL}/companiesHouseSearch?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Registry search failed');
      const data = await response.json();
      return (data.items || []).map(this.mapToCompany);
    } catch (err) {
      console.error("Search error:", err);
      return [];
    }
  }

  async getCompanyByNumber(companyNumber: string): Promise<Company | null> {
    if (!this.isConfigured) return null;
    try {
      const response = await fetch(`${CLOUD_FUNCTION_BASE_URL}/companiesHouseProfile?number=${companyNumber}`);
      if (!response.ok) return null;
      const data = await response.json();
      return this.mapToCompany(data);
    } catch (err) {
      return null;
    }
  }

  private mapToCompany(item: any): Company {
    const name = item.title || item.company_name;
    const number = item.company_number;
    if (!name || !number) return null as any;

    return {
      companyNumber: number,
      companyName: name,
      companyStatus: item.company_status || 'active',
      incorporationDate: item.date_of_creation || 'Unknown',
      registeredAddress: {
        addressLine1: item.address?.address_line_1 || 'No address',
        locality: item.address?.locality || 'N/A',
        postalCode: item.address?.postal_code || ''
      },
      sicCodes: item.sic_codes || [],
      riskLevel: item.company_status === 'active' ? 'low' : 'high'
    };
  }

  async saveToFirestore(company: Company) {
    if (!this.isFirebaseConfigured || !company?.companyNumber) return;
    try {
      const docRef = doc(db, "verified_entities", company.companyNumber);
      await setDoc(docRef, { ...company, syncedAt: serverTimestamp() });
    } catch (e) {
      console.warn("Firestore: Persistence skipped (Permissions or Placeholder Config)");
    }
  }

  async getPersistedCompanies(): Promise<Company[]> {
    if (!this.isFirebaseConfigured) return [];
    try {
      const snapshot = await getDocs(this.collectionRef);
      return snapshot.docs.map(doc => doc.data() as Company);
    } catch (err) {
      return [];
    }
  }

  async verifyBulk(
    input: string, 
    onProgress?: (percent: number) => void,
    onLog?: (msg: string) => void
  ): Promise<Company[]> {
    const lines = input.split(/[\n,;]/).map(l => l.trim()).filter(l => l.length > 0);
    const results: Company[] = [];
    const total = lines.length;

    for (let i = 0; i < total; i++) {
      const line = lines[i];
      if (onLog) onLog(`> SYNCING: ${line}...`);
      
      const search = await this.searchCompany(line);
      const company = search.length > 0 ? search[0] : null;

      if (company) {
        results.push(company);
        await this.saveToFirestore(company);
        if (onLog) onLog(`> MATCH: ${company.companyName}`);
      }

      if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
      await new Promise(r => setTimeout(r, this.isConfigured ? 200 : 100));
    }
    return results;
  }
}

export const companyRegistryService = new CompanyRegistryService();
