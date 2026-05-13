export type RecordStatus = "active" | "inactive" | "archived";

export type Industry = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
};

export type CompanyCategory = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  description: string | null;
  priority_level: number;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
};

export type PipelineStage = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  probability: number;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadTemperature = "cold" | "warm" | "hot" | "very_hot";

export type CompanyPriority = "low" | "medium" | "high" | "urgent";

export type InteractionType =
  | "Phone Call"
  | "Physical Meeting"
  | "Online Meeting"
  | "WhatsApp Discussion"
  | "Email Follow-up"
  | "Demo Meeting"
  | "Technical Meeting"
  | "Quotation Discussion"
  | "Payment Discussion"
  | "Closing Meeting"
  | "Other";

export type DecisionRole =
  | "Owner"
  | "CEO / MD"
  | "Director"
  | "Procurement"
  | "IT Head"
  | "Admin"
  | "Engineer"
  | "Finance"
  | "Influencer"
  | "Gatekeeper"
  | "Other";

export type RelationshipLevel =
  | "New"
  | "Known"
  | "Warm"
  | "Strong"
  | "Decision Maker"
  | "Risky"
  | "Inactive";

export type PreferredContactMethod =
  | "Phone"
  | "WhatsApp"
  | "Email"
  | "LinkedIn"
  | "Physical Meeting";

export type Company = {
  id: string;
  organization_id: string;
  name: string;
  industry_id: string | null;
  category_id: string | null;
  lead_source: string | null;
  referred_by_user_id: string | null;
  priority: CompanyPriority;
  assigned_user_id: string | null;
  pipeline_stage_id: string | null;
  lead_score: number;
  status: RecordStatus;
  phone: string | null;
  phone_numbers: string[];
  whatsapp: string | null;
  email: string | null;
  email_addresses: string[];
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  success_rating: number | null;
  lead_temperature: LeadTemperature;
  estimated_value: number | null;
  expected_closing_date: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  industries?: Pick<Industry, "id" | "name"> | null;
  company_categories?: Pick<CompanyCategory, "id" | "name" | "code"> | null;
  pipeline_stages?: Pick<PipelineStage, "id" | "name" | "color" | "probability" | "is_won" | "is_lost"> | null;
  assigned_profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  created_profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  primary_contact?: Pick<ContactPerson, "id" | "name" | "mobile" | "email" | "designation"> | null;
};

export type ContactPerson = {
  id: string;
  organization_id: string;
  company_id: string;
  name: string;
  designation: string | null;
  department: string | null;
  mobile: string | null;
  mobile_numbers: string[];
  whatsapp: string | null;
  email: string | null;
  email_addresses: string[];
  linkedin: string | null;
  decision_role: DecisionRole | null;
  relationship_level: RelationshipLevel | null;
  preferred_contact_method: PreferredContactMethod | null;
  remarks: string | null;
  is_primary: boolean;
  status: RecordStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  companies?: Pick<Company, "id" | "name" | "phone" | "email"> | null;
  created_profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
};

export type TeamMemberOption = {
  id: string;
  full_name: string | null;
  email: string;
};

export type CompanyFilters = {
  search?: string;
  industry?: string;
  category?: string;
  pipeline?: string;
  priority?: string;
  temperature?: string;
  assigned?: string;
};

export type PipelineBoardCompany = Company & {
  next_followup_at: string | null;
  last_interaction_at: string | null;
};

export type PipelineBoardSummary = {
  totalPipelineValue: number;
  totalActiveDeals: number;
  hotLeads: number;
  wonDeals: number;
  lostDeals: number;
  overdueFollowups: number;
};

export type PipelineBoardData = {
  stages: PipelineStage[];
  companies: PipelineBoardCompany[];
  teamMembers: TeamMemberOption[];
  industries: Industry[];
  categories: CompanyCategory[];
  summary: PipelineBoardSummary;
};

export type ContactFilters = {
  search?: string;
  company?: string;
  decisionRole?: string;
  relationshipLevel?: string;
  preferredMethod?: string;
  status?: string;
};

export type Interaction = {
  id: string;
  organization_id: string;
  company_id: string;
  contact_person_id: string | null;
  assigned_user_id: string | null;
  interaction_type: InteractionType;
  meeting_datetime: string;
  location: string | null;
  online_meeting_link: string | null;
  discussion_details: string;
  client_requirement: string | null;
  pain_point: string | null;
  proposed_solution: string | null;
  budget_discussion: string | null;
  competitor_mentioned: string | null;
  decision_timeline: string | null;
  success_rating: number | null;
  lead_temperature: LeadTemperature | null;
  next_action: string | null;
  next_followup_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  need_help: boolean;
  internal_note: string | null;
  status: RecordStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  companies?: Pick<Company, "id" | "name"> | null;
  contact_persons?: Pick<ContactPerson, "id" | "name" | "mobile" | "email"> | null;
  assigned_profile?: TeamMemberOption | null;
  created_profile?: TeamMemberOption | null;
};

export type InteractionFilters = {
  search?: string;
  company?: string;
  contact?: string;
  type?: string;
  ratingMin?: string;
  ratingMax?: string;
  temperature?: string;
  assigned?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
};

export type FollowupType =
  | "Phone Call"
  | "Email"
  | "WhatsApp"
  | "Physical Meeting"
  | "Online Meeting"
  | "Quotation Follow-up"
  | "Payment Follow-up"
  | "Technical Follow-up"
  | "Demo Follow-up"
  | "Decision Follow-up"
  | "Other";

export type FollowupStatus = "pending" | "completed" | "rescheduled" | "cancelled" | "archived";

export type FollowupPriority = "low" | "medium" | "high" | "urgent";

export type Followup = {
  id: string;
  organization_id: string;
  company_id: string;
  contact_person_id: string | null;
  interaction_id: string | null;
  assigned_user_id: string | null;
  followup_type: FollowupType;
  title: string;
  description: string | null;
  scheduled_at: string;
  reminder_before_minutes: number;
  status: FollowupStatus;
  priority: FollowupPriority;
  completed_at: string | null;
  completed_by: string | null;
  rescheduled_from: string | null;
  cancelled_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  companies?: Pick<Company, "id" | "name"> | null;
  contact_persons?: Pick<ContactPerson, "id" | "name" | "mobile" | "email"> | null;
  interactions?: Pick<Interaction, "id" | "interaction_type" | "meeting_datetime"> | null;
  assigned_profile?: TeamMemberOption | null;
  created_profile?: TeamMemberOption | null;
};

export type FollowupFilters = {
  search?: string;
  company?: string;
  contact?: string;
  assigned?: string;
  type?: string;
  priority?: string;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
};

export type DocumentType =
  | "Company Profile"
  | "Brochure"
  | "Quotation"
  | "Technical Proposal"
  | "Financial Proposal"
  | "Agreement"
  | "Presentation"
  | "BOQ"
  | "Meeting File"
  | "Product Catalogue"
  | "Invoice"
  | "Purchase Order"
  | "Other";

export type DocumentStatus =
  | "draft"
  | "submitted"
  | "seen"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "archived";

export type Document = {
  id: string;
  organization_id: string;
  company_id: string;
  contact_person_id: string | null;
  interaction_id: string | null;
  followup_id: string | null;
  document_type: DocumentType;
  title: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_url: string | null;
  file_size_mb: number | null;
  mime_type: string | null;
  file_extension: string | null;
  status: DocumentStatus;
  submitted_to: string | null;
  submitted_at: string | null;
  expiry_date: string | null;
  remarks: string | null;
  created_by: string | null;
  updated_by: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  companies?: Pick<Company, "id" | "name"> | null;
  contact_persons?: Pick<ContactPerson, "id" | "name" | "mobile" | "email"> | null;
  interactions?: Pick<Interaction, "id" | "interaction_type" | "meeting_datetime"> | null;
  followups?: Pick<Followup, "id" | "title" | "scheduled_at"> | null;
  uploaded_profile?: TeamMemberOption | null;
};

export type DocumentFilters = {
  search?: string;
  company?: string;
  type?: string;
  status?: string;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type HelpRequestType =
  | "General Support"
  | "Need Technical Support"
  | "Need Price Approval"
  | "Need Senior Meeting"
  | "Need Product Demo"
  | "Need Quotation Support"
  | "Need Proposal Support"
  | "Need Management Decision"
  | "Need Site Visit"
  | "Need Document Support"
  | "Need Payment Follow-up"
  | "Other";

export type HelpRequestStatus = "open" | "in_progress" | "resolved" | "rejected" | "archived";

export type HelpRequestPriority = "low" | "medium" | "high" | "urgent";

export type HelpRequest = {
  id: string;
  organization_id: string;
  company_id: string;
  contact_person_id: string | null;
  interaction_id: string | null;
  followup_id: string | null;
  document_id: string | null;
  requested_by: string;
  assigned_to: string | null;
  help_type: HelpRequestType;
  title: string;
  description: string | null;
  priority: HelpRequestPriority;
  status: HelpRequestStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  companies?: Pick<Company, "id" | "name"> | null;
  contact_persons?: Pick<ContactPerson, "id" | "name" | "mobile" | "email"> | null;
  interactions?: Pick<Interaction, "id" | "interaction_type" | "meeting_datetime"> | null;
  followups?: Pick<Followup, "id" | "title" | "scheduled_at"> | null;
  documents?: Pick<Document, "id" | "title" | "document_type"> | null;
  requested_profile?: TeamMemberOption | null;
  assigned_profile?: TeamMemberOption | null;
  created_profile?: TeamMemberOption | null;
  resolved_profile?: TeamMemberOption | null;
};

export type HelpRequestComment = {
  id: string;
  organization_id: string;
  help_request_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  user_profile?: TeamMemberOption | null;
};

export type HelpRequestFilters = {
  search?: string;
  company?: string;
  contact?: string;
  interaction?: string;
  followup?: string;
  document?: string;
  helpType?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
  requestedBy?: string;
  dateFrom?: string;
  dateTo?: string;
};
