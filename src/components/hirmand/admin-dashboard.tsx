import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Activity,
  BarChart3,
  Building2,
  Clock3,
  Eye,
  Globe2,
  ImageOff,
  Music2,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AdminCardSkeleton, AdminErrorBanner } from "@/components/hirmand/admin-ui";
import { AdminCampaignLinkBuilder } from "@/components/hirmand/admin-campaign-link-builder";
import { AdminActionCenter } from "@/components/hirmand/admin-action-center";
import { AdminPropertyLifecyclePanel } from "@/components/hirmand/admin-property-lifecycle-panel";
import { AdminNeighborhoodDemandRadar } from "@/components/hirmand/admin-neighborhood-demand-radar";
import { fa, faBytes } from "@/components/hirmand/admin-ui-utils";

type LeadStatus = "new" | "contacted" | "follow_up" | "visited" | "contract" | "closed" | "spam";

type DashboardData = {
  properties: {
    total: number;
    published: number;
    draft: number;
    archived: number;
    featured: number;
    withoutImages: number;