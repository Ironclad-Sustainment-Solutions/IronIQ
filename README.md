# IronIQ Insight

Build a professional authenticated B2B web application called IronIQ.

IronIQ is a manufacturing intelligence and operational-improvement platform developed by Ironclad Sustainment Solutions. The first module will assess, score, and improve a manufacturing facility’s readiness to produce repeatable, compliant, high-quality products at scale.

This is not a marketing website. Build the actual logged-in application.

TECHNOLOGY

Use:

- React

- TypeScript

- Tailwind CSS

- Supabase for authentication, PostgreSQL database, and file storage

- Recharts or another clean React charting library

- Responsive desktop-first design

- Reusable components

- Strong TypeScript typing

Use fictional demonstration data only.

DESIGN DIRECTION

Create a polished industrial and executive design appropriate for automotive, aerospace, defense, maritime, and precision-manufacturing customers.

The interface should feel modern, serious, technical, and credible.

Use:

- Dark navy, charcoal, white, steel gray, and restrained amber accents

- Clean cards

- Clear typography

- Minimal visual clutter

- Industrial dashboard styling

- Professional charts and score indicators

- Accessible contrast

- Responsive layouts

Do not make the interface look like a generic startup template.

APPLICATION STRUCTURE

Create a left-side navigation menu with:

1. Executive Dashboard

2. Organizations

3. Facilities

4. Assessments

5. Assessment Templates

6. Findings

7. Improvement Projects

8. Reports

9. Administration

Include a top navigation bar with:

- Current organization

- Current facility

- Notifications

- User profile

- Logout

USER ROLES

Create the following user roles:

1. IronIQ Administrator

2. Ironclad Consultant

3. Customer Administrator

4. Facility Manager

5. Assessor

6. Read-Only Executive

Permissions should be designed so users only see organizations and facilities they are authorized to access.

ORGANIZATIONS AND FACILITIES

An organization may have multiple facilities.

Each organization should include:

- Organization name

- Industry

- Headquarters location

- Primary contact

- Status

- Date added

Each facility should include:

- Facility name

- Organization

- Address

- Primary products

- Primary manufacturing processes

- Number of machines

- Number of employees

- Operating shifts

- Certifications

- Primary contact

- Facility status

- Last assessment date

- Current readiness score

Create fictional demo data for one automotive casting and machining facility with approximately 36 machining centers.

MANUFACTURING READINESS ASSESSMENT

Create an assessment framework with seven weighted categories:

1. Engineering Readiness: 20%

2. Process Readiness: 20%

3. Tooling Readiness: 15%

4. Quality Readiness: 15%

5. Fixture Readiness: 10%

6. Machine Health: 10%

7. Data and Digital Readiness: 10%

Each question must be scored from 0 to 5:

0 = Not present

1 = Ad hoc

2 = Partially defined

3 = Defined and generally followed

4 = Measured and controlled

5 = Optimized and continuously improved

Each assessment question must support:

- Question ID

- Category

- Question text

- Guidance text

- Question weight

- Critical-question designation

- Score from 0 to 5

- Assessor comments

- Evidence type

- Evidence description

- Evidence attachment

- Finding severity

- Recommended corrective action

- Responsible owner

- Target completion date

- Status

ASSESSMENT WORKFLOW

Create a multi-step assessment workflow:

Step 1: Select organization and facility

Step 2: Enter assessment information

Include:

- Assessment name

- Assessment type

- Assessment date

- Lead assessor

- Supporting assessors

- Scope

- Production area

- Product family

- Notes

Step 3: Complete assessment questions by category

Show:

- Category progress

- Question score

- Scoring guidance

- Notes

- Evidence

- Critical-question indicator

- Save draft functionality

Step 4: Review findings

Automatically create findings when:

- A critical question is scored 0 or 1

- A noncritical question is scored 0, 1, or 2

Allow assessors to edit severity and recommendations.

Step 5: Review and finalize assessment

Show:

- Overall score

- Category scores

- Confidence score

- Completion percentage

- Critical failures

- Findings by severity

- Recommended actions

Require confirmation before finalizing.

Once finalized, the assessment should become read-only unless reopened by an authorized administrator.

SCORING LOGIC

Calculate each category score using:

Category Score =

sum of score multiplied by question weight

divided by

5 multiplied by the sum of applicable question weights

multiplied by 100

Calculate the overall Manufacturing Readiness Score using the category weights.

Round displayed scores to one decimal place.

Do not treat unanswered questions as zero.

Show an assessment as incomplete when required questions remain unanswered.

READINESS LEVELS

Use the following readiness levels:

90 to 100 = Advanced

80 to 89.9 = Production Ready

70 to 79.9 = Conditionally Ready

60 to 69.9 = Needs Improvement

Below 60 = High Risk

CRITICAL GATING RULE

A facility must not be labeled Production Ready or Advanced when any critical question is scored 0 or 1.

When a critical failure exists:

- Display a prominent critical-risk banner

- Cap the readiness status at Conditionally Ready

- Automatically create a critical finding

- Clearly identify the failed control

- Show the corrective action required

CONFIDENCE SCORE

Calculate a separate Confidence Score based on the strength of evidence supporting each answered question.

Use these values:

- No evidence provided = 15%

- Verbal statement only = 25%

- Document provided = 60%

- Record sampled and verified = 80%

- Direct observation = 90%

- System-generated or live data = 100%

Calculate the overall Confidence Score using the strongest current evidence attached to each answered question.

Do not combine the Confidence Score with the Manufacturing Readiness Score.

Display them as separate metrics.

EXECUTIVE DASHBOARD

Build an executive dashboard showing:

- Overall Manufacturing Readiness Score

- Confidence Score

- Assessment completion percentage

- Current readiness level

- Previous readiness score

- Change since previous assessment

- Number of critical findings

- Number of open findings

- Findings by severity

- Category score breakdown

- Readiness trend over time

- Top five risks

- Top five recommended actions

- Improvement projects currently underway

- Upcoming corrective-action due dates

Use:

- Score cards

- Horizontal category bars

- Radar chart for category readiness

- Line chart for score trends

- Donut chart for findings by severity

- Findings table

- Corrective-action summary

ASSESSMENT QUESTIONS

Create at least five fictional demonstration questions for each category.

Include example questions such as:

Engineering Readiness:

- Are current drawings, models, specifications, and revisions available at the point of use?

- Are CNC programs controlled through an approved revision process?

- Are manufacturing requirements translated into documented process plans?

- Are engineering changes reviewed before production implementation?

- Are digital work instructions complete and current?

Process Readiness:

- Is standard work documented for each critical operation?

- Are cycle times measured against approved standards?

- Are setup procedures repeatable across operators and shifts?

- Are process capability metrics tracked for critical characteristics?

- Are bottlenecks identified and actively managed?

Tooling Readiness:

- Are approved cutting tools standardized by operation?

- Is tool life measured and documented?

- Are tool-change criteria defined?

- Is tooling inventory sufficient to support planned production?

- Are presetting and offset-management processes controlled?

Quality Readiness:

- Are inspection gauges calibrated and traceable?

- Is first-article approval completed before production release?

- Are nonconforming products identified and controlled?

- Is first-pass yield measured?

- Are corrective actions verified for effectiveness?

Fixture Readiness:

- Are fixtures validated before production use?

- Is fixture repeatability measured?

- Are fixture maintenance requirements defined?

- Are critical locating surfaces inspected?

- Are setup and clamping instructions documented?

Machine Health:

- Is preventive maintenance completed on schedule?

- Are machine alarms and downtime recorded?

- Are calibration and alignment records current?

- Is mean time between failure measured?

- Are recurring machine faults analyzed?

Data and Digital Readiness:

- Are machine states collected automatically?

- Is production performance visible in real time?

- Are downtime reasons consistently recorded?

- Are production records linked to parts, lots, programs, and revisions?

- Can audit evidence be retrieved without extensive manual effort?

FINDINGS AND CORRECTIVE ACTIONS

Create a findings register with:

- Finding ID

- Organization

- Facility

- Assessment

- Category

- Related question

- Severity

- Finding description

- Business impact

- Root cause

- Recommended corrective action

- Assigned owner

- Target date

- Current status

- Evidence of closure

- Verified by

- Verification date

Severity levels:

- Critical

- High

- Medium

- Low

- Opportunity

Statuses:

- Open

- Assigned

- In Progress

- Awaiting Verification

- Closed

- Accepted Risk

Allow filtering by organization, facility, category, severity, owner, status, and due date.

IMPROVEMENT PROJECTS

Create an improvement-project page that converts findings into managed projects.

Each project should include:

- Project name

- Facility

- Related findings

- Project owner

- Executive sponsor

- Objective

- Baseline metric

- Target metric

- Estimated financial impact

- Planned start date

- Planned completion date

- Current status

- Percent complete

- Risks

- Actions

- Results achieved

REPORTS

Create report views for:

1. Executive Readiness Report

2. Detailed Assessment Report

3. Critical Findings Report

4. Corrective Action Status Report

5. Facility Comparison Report

6. Readiness Trend Report

7. Audit Evidence Report

Add buttons for:

- Print

- Export to PDF

- Export findings to CSV

For the first version, the export buttons may use browser-based print and CSV generation.

ASSESSMENT TEMPLATES

Create an assessment-template administration page.

Administrators must be able to:

- Create a template

- Add or remove categories

- Set category weights

- Add questions

- Set question weights

- Mark questions as critical

- Add scoring guidance

- Define required evidence

- Publish a template version

- Archive a template

- Duplicate an existing template

Published templates must be version-controlled.

An assessment must retain the exact template version used when the assessment was created.

DATABASE

Create a Supabase database structure for:

- profiles

- organizations

- organization_members

- facilities

- facility_members

- assessment_templates

- assessment_template_versions

- assessment_categories

- assessment_questions

- assessments

- assessment_responses

- evidence

- findings

- corrective_actions

- improvement_projects

- project_findings

- audit_logs

Include:

- UUID primary keys

- created_at and updated_at fields

- created_by and updated_by fields where appropriate

- organization_id and facility_id relationships

- foreign-key constraints

- reasonable indexes

- status fields

- soft-delete or archive capability where appropriate

SECURITY

Implement Supabase Row Level Security.

Users must only access authorized organizations and facilities.

IronIQ Administrators may access all records.

Customer users must not see another customer’s data.

Do not store Supabase service-role credentials in frontend code.

Do not expose secrets.

Add an audit log for:

- Assessment creation

- Score changes

- Assessment finalization

- Assessment reopening

- Finding changes

- Corrective-action closure

- User role changes

- Template publication

DEMO DATA

Create realistic fictional demo data for:

- One manufacturing organization

- One automotive casting and machining facility

- Approximately 36 machining centers

- One completed assessment

- One assessment in progress

- Seven category scores

- Multiple findings

- Multiple corrective actions

- Two improvement projects

- Historical score data for trend charts

Use a fictional company and fictional contacts. Do not use Grede, SECO, or any real company information.

INITIAL DEMO SCORES

Use these fictional category scores:

- Engineering Readiness: 78

- Process Readiness: 66

- Tooling Readiness: 72

- Quality Readiness: 81

- Fixture Readiness: 63

- Machine Health: 69

- Data and Digital Readiness: 42

The fictional facility should have:

- Overall readiness around 68

- Confidence around 61%

- Two critical findings

- Several high and medium findings

- Major opportunities involving CNC program control, fixture repeatability, tool-life tracking, machine connectivity, downtime data, and audit-record retrieval

BUILD ORDER

Build the first version in this order:

1. Application shell and navigation

2. Login and user profiles

3. Organizations and facilities

4. Assessment template and demo questions

5. Assessment workflow

6. Scoring engine

7. Critical gating logic

8. Confidence scoring

9. Executive dashboard

10. Findings and corrective actions

11. Improvement projects

12. Reports

13. Supabase schema and Row Level Security

14. Demo data

15. Responsive design and final polish

IMPORTANT DEVELOPMENT RULES

- Keep scoring logic in reusable TypeScript functions.

- Do not calculate scores only inside visual components.

- Use clear domain models and interfaces.

- Add validation for scores and weights.

- Category weights must total 100%.

- Question scores must be integers from 0 to 5.

- Do not count unanswered questions as zero.

- Preserve finalized assessment results.

- Use reusable components.

- Keep the application GitHub-ready.

- Include a clear README describing setup, environment variables, scoring logic, and database configuration.

- Prioritize a working assessment and dashboard over unnecessary features.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/87263d01-ef31-417b-a258-34f21c822fb4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
