export interface SampleOrg {
  id: string;
  name: string;
  slug: string;
  org_type: "nonprofit" | "faith_based" | "school" | "medical" | "housing" | "government" | "community";
  county: string;
  description: string;
  services: string[];
  has_funding: boolean;
  accepts_case_conference: boolean;
  contact: {
    name: string;
    title: string;
    phone: string;
  };
}

export const sampleOrganizations: SampleOrg[] = [
  {
    id: "1",
    name: "Cobb Community Organizations in Action",
    slug: "coia",
    org_type: "nonprofit",
    county: "Cobb",
    description:
      "Connects low-income Cobb County residents to emergency financial assistance, housing support, and community resources.",
    services: ["Housing & Stability", "Income & Benefits"],
    has_funding: true,
    accepts_case_conference: true,
    contact: {
      name: "Marcus Webb",
      title: "Housing Navigator",
      phone: "(770) 555-0142",
    },
  },
  {
    id: "2",
    name: "New Hope Community Church",
    slug: "new-hope",
    org_type: "faith_based",
    county: "Cobb",
    description:
      "Faith-based community support offering emergency assistance, food access, and life navigation services rooted in relational care.",
    services: ["Life Navigation", "Income & Benefits"],
    has_funding: false,
    accepts_case_conference: true,
    contact: {
      name: "Pastor Diane Okafor",
      title: "Community Liaison",
      phone: "(770) 555-0187",
    },
  },
  {
    id: "3",
    name: "Marietta City Schools — Student Services",
    slug: "marietta-schools",
    org_type: "school",
    county: "Cobb",
    description:
      "School-based social work team supporting students and families navigating housing instability, attendance barriers, and access to community resources.",
    services: ["Life Navigation"],
    has_funding: false,
    accepts_case_conference: true,
    contact: {
      name: "Tanya Reeves",
      title: "Lead Social Worker",
      phone: "(770) 555-0231",
    },
  },
  {
    id: "4",
    name: "WellStar Community Health",
    slug: "wellstar",
    org_type: "medical",
    county: "Cobb",
    description:
      "Community health navigation connecting patients to healthcare access, benefits enrollment, and social determinants of health support.",
    services: ["Health & Wellness"],
    has_funding: true,
    accepts_case_conference: false,
    contact: {
      name: "Jerome Pittman",
      title: "Patient Navigator",
      phone: "(770) 555-0309",
    },
  },
  {
    id: "5",
    name: "Paulding County Family Services",
    slug: "paulding-family",
    org_type: "nonprofit",
    county: "Paulding",
    description:
      "Comprehensive family stabilization services including housing assistance, benefits navigation, and case coordination for families in crisis.",
    services: ["Housing & Stability", "Income & Benefits"],
    has_funding: true,
    accepts_case_conference: true,
    contact: {
      name: "Alicia Moreno",
      title: "Case Coordination Supervisor",
      phone: "(770) 555-0418",
    },
  },
  {
    id: "6",
    name: "Sixth Day Ministries",
    slug: "sixth-day",
    org_type: "faith_based",
    county: "Douglas",
    description:
      "Community ministry providing transitional support, housing navigation, and life skills programming for individuals and families rebuilding stability.",
    services: ["Life Navigation", "Housing & Stability"],
    has_funding: false,
    accepts_case_conference: true,
    contact: {
      name: "Elder Raymond Cole",
      title: "Director of Community Services",
      phone: "(770) 555-0524",
    },
  },
];

export default sampleOrganizations;
