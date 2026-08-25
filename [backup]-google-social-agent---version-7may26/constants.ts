import { ProductArea } from "./types";

export const PRODUCT_AREA_COLORS: Record<ProductArea, string> = {
  [ProductArea.Pixel]: "bg-[#4285F4]/20 text-[#8AB4F8] border-[#4285F4]/50 border shadow-[0_0_10px_rgba(66,133,244,0.2)]", // Google Blue
  [ProductArea.Search]: "bg-[#FBBC05]/20 text-[#FDE293] border-[#FBBC05]/50 border shadow-[0_0_10px_rgba(251,188,5,0.2)]", // Google Yellow
  [ProductArea.Gemini]: "bg-purple-500/20 text-purple-300 border-purple-500/50 border shadow-[0_0_10px_rgba(168,85,247,0.2)]", // Purple
  [ProductArea.BrandCulture]: "bg-[#EA4335]/20 text-[#F28B82] border-[#EA4335]/50 border shadow-[0_0_10px_rgba(234,67,53,0.2)]", // Google Red
  [ProductArea.Education]: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 border shadow-[0_0_10px_rgba(6,182,212,0.2)]",
  [ProductArea.Android]: "bg-[#34A853]/20 text-[#81C995] border-[#34A853]/50 border shadow-[0_0_10px_rgba(52,168,83,0.2)]", // Google Green
};