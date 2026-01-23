export type Dzongkhag = {
  name: string;
  lat: number;
  lon: number;
};

export const dzongkhagCenters: Dzongkhag[] = [
  { name: "Thimphu", lat: 27.4728, lon: 89.639 },
  { name: "Paro", lat: 27.4305, lon: 89.4131 },
  { name: "Punakha", lat: 27.5921, lon: 89.8797 },
  { name: "Gasa", lat: 27.9037, lon: 89.7269 },
  { name: "Haa", lat: 27.3875, lon: 89.2831 },
  { name: "Chhukha", lat: 26.8400, lon: 89.3800 },
  { name: "Dagana", lat: 27.0700, lon: 89.8800 },
  { name: "Tsirang", lat: 27.0200, lon: 90.1200 },
  { name: "Wangdue Phodrang", lat: 27.4800, lon: 89.9000 },
  { name: "Bumthang", lat: 27.5500, lon: 90.7400 },
  { name: "Trongsa", lat: 27.5000, lon: 90.5100 },
  { name: "Zhemgang", lat: 27.2200, lon: 90.6600 },
  { name: "Sarpang", lat: 26.8600, lon: 90.2700 },
  { name: "Samtse", lat: 26.8900, lon:89.0900 },
  { name: "Mongar", lat: 27.2700, lon: 91.2400 },
  { name: "Lhuentse", lat: 27.6600, lon: 91.1800 },
  { name: "Trashigang", lat: 27.3300, lon: 91.5500 },
  { name: "Trashiyangtse", lat: 27.6100, lon: 91.4900 },
  { name: "Pemagatshel", lat: 27.0300, lon: 91.3500 },
  { name: "Samdrup Jongkhar", lat: 26.8000, lon: 91.5000 },
  // Optional: Gelephu is a Thromde under Sarpang, but kept for better accuracy
  { name: "Gelephu", lat: 26.8900, lon: 90.5000 }, 
  { name: "Phuentsholing", lat: 26.8608, lon: 89.3848 },
];