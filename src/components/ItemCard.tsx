import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, Tag } from "lucide-react";
import { format } from "date-fns";

interface Props {
  item: {
    id: string;
    item_name: string;
    description: string | null;
    category: string;
    image_url: string | null;
    status: string;
    location_lost?: string;
    location_found?: string;
    date_lost?: string;
    date_found?: string;
    contact_number?: string | null;
  };
  type: "lost" | "found";
  actions?: React.ReactNode;
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  matched: "bg-accent/20 text-accent-foreground border-accent/40",
  recovered: "bg-success/15 text-success border-success/30",
  claimed: "bg-accent/20 text-accent-foreground border-accent/40",
  returned: "bg-success/15 text-success border-success/30",
};

export function ItemCard({ item, type, actions }: Props) {
  const location = type === "lost" ? item.location_lost : item.location_found;
  const date = type === "lost" ? item.date_lost : item.date_found;
  return (
    <Card className="group overflow-hidden border-border/60 bg-card/80 backdrop-blur transition-all hover:shadow-glow hover:-translate-y-1">
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {item.image_url ? (
          <img src={item.image_url} alt={item.item_name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-brand/10 text-muted-foreground">
            <Tag className="h-12 w-12" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{item.item_name}</h3>
          <Badge variant="outline" className={STATUS_TONE[item.status] ?? ""}>{item.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{item.category}</span>
          {date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(date), "MMM d, yyyy")}</span>}
          {location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>}
        </div>
        {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
        {item.contact_number && <p className="text-xs text-foreground/80">Contact: {item.contact_number}</p>}
        {actions && <div className="pt-2 flex gap-2">{actions}</div>}
      </div>
    </Card>
  );
}
