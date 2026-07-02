import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

export type Place = {
  address: string;
  district: string | null;
  lng: number;
  lat: number;
};

export type Item = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  pickup_address: string;
  pickup_district: string | null;
  pickup_lng: number;
  pickup_lat: number;
  dropoff_address: string;
  dropoff_district: string | null;
  dropoff_lng: number;
  dropoff_lat: number;
  valid_until: string;
  status: string;
  uploader_id: string;
  selected_by: string | null;
  delivered_at: string | null;
  completed_at: string | null;
};

type SearchContextValue = {
  origin: Place | null;
  setOrigin: Dispatch<SetStateAction<Place | null>>;
  destination: Place | null;
  setDestination: Dispatch<SetStateAction<Place | null>>;
  radiusKm: string;
  setRadiusKm: Dispatch<SetStateAction<string>>;
  results: Item[];
  setResults: Dispatch<SetStateAction<Item[]>>;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: PropsWithChildren) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [radiusKm, setRadiusKm] = useState('3');
  const [results, setResults] = useState<Item[]>([]);

  return (
    <SearchContext.Provider
      value={{
        origin,
        setOrigin,
        destination,
        setDestination,
        radiusKm,
        setRadiusKm,
        results,
        setResults,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
