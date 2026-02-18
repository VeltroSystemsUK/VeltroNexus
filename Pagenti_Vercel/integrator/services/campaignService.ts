
import { Campaign } from "../types";
import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";

export class CampaignService {
  private collectionRef = collection(db, "campaigns");

  async getCampaigns(): Promise<Campaign[]> {
    try {
      const q = query(this.collectionRef, orderBy("sentAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
    } catch (error) {
      console.error("Firestore fetch error:", error);
      return [];
    }
  }

  async createCampaign(data: Partial<Campaign>): Promise<Campaign> {
    const newCampaign = {
      name: data.name || 'Untitled Mission',
      status: 'draft',
      subject: data.subject || '',
      recipientsCount: data.recipientsCount || 0,
      openRate: 0,
      clickRate: 0,
      createdAt: serverTimestamp(),
      ...data
    };
    
    const docRef = await addDoc(this.collectionRef, newCampaign);
    return { id: docRef.id, ...newCampaign } as Campaign;
  }

  async launchCampaign(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, "campaigns", id);
      await updateDoc(docRef, {
        status: 'sent',
        sentAt: new Date().toISOString().split('T')[0]
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const campaignService = new CampaignService();
