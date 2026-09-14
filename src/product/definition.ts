import { validateAuthorization as validate0 } from '../protocol-amendment/policy'
import { validateAuthorization as validate1 } from '../site-activation/policy'
import { validateAuthorization as validate2 } from '../subject-eligibility/policy'
import { validateAuthorization as validate3 } from '../visit-window/policy'
import { validateAuthorization as validate4 } from '../enrollment-cap/policy'
import { validateAuthorization as validate5 } from '../protocol-deviation/policy'
import { validateAuthorization as validate6 } from '../adverse-event/policy'
import { validateAuthorization as validate7 } from '../database-lock/policy'
import type { Entity, Field, Operation, Product } from '../workspace/types'
import { entity, number, requireThat, text } from '../workspace/values'
const roles=["Trial Manager","Principal Investigator","Clinical Research Associate","Medical Monitor"] as const
const textField=(key:string,label:string):Field=>({key,label,type:'text',required:true,initial:'Evidence pending'})
const numberField=(key:string,label:string,initial:number):Field=>({key,label,type:'number',required:true,integer:true,min:0,max:1000000000,initial})
const dateField=(key:string,label:string):Field=>({key,label,type:'date',required:true,initial:'2026-09-14'})
type Validator=(record:{measured:number;limit:number;evidence:string;revision:number})=>unknown
function workflowOperations(kind:string,label:string,validate:Validator):Operation[]{return[
  {key:kind+'-submit',label:'Submit '+label,kind,from:['draft'],roles:[roles[0]],run:({entity})=>{entity.status='review';return label+' submitted for independent review.'}},
  {key:kind+'-authorize',label:'Authorize '+label,kind,from:['review'],roles:[roles[1]],run:({entity})=>{validate({measured:number(entity.fields,'measured'),limit:number(entity.fields,'limit'),evidence:text(entity.fields,'evidence'),revision:entity.revision});entity.status='authorized';return label+' authorized against current evidence and limits.'}},
  {key:kind+'-execute',label:'Execute '+label,kind,from:['authorized'],roles:[roles[2]],run:({entity,now})=>{requireThat(text(entity.fields,'effectiveDate')<=now.slice(0,10),'The effective date has not arrived.');entity.status='active';return label+' executed with operational custody recorded.'}},
  {key:kind+'-block',label:'Block '+label,kind,from:['authorized','active'],roles:[roles[0],roles[2]],fields:[textField('reason','Blocking reason')],run:({entity,input})=>{requireThat(text(input,'reason').trim().length>=8,'A specific blocking reason is required.');entity.status='blocked';return label+' blocked without losing prior evidence.'}},
  {key:kind+'-recover',label:'Recover '+label,kind,from:['blocked'],roles:[roles[1]],fields:[textField('recovery','Recovery evidence')],run:({entity,input})=>{requireThat(text(input,'recovery').trim().length>=8,'Recovery evidence is required.');entity.status='review';return label+' returned to review with recovery evidence.'}},
  {key:kind+'-close',label:'Close '+label,kind,from:['active'],roles:[roles[3]],run:({entity})=>{entity.status='closed';return label+' closed by accountable authority.'}},
]}
const kinds=[{
    key:"protocol-amendment", label:"Protocol amendment control", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Site protocol revision",6), numberField('limit',"Approved protocol revision",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"site-activation", label:"Site activation", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Readiness score",4), numberField('limit',"Minimum activation score",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"subject-eligibility", label:"Subject eligibility", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Eligibility exceptions",6), numberField('limit',"Maximum allowed exceptions",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"visit-window", label:"Protocol visit windows", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Visit day",4), numberField('limit',"Latest permitted day",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"enrollment-cap", label:"Enrollment capacity", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Requested enrollments",6), numberField('limit',"Available cohort slots",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"protocol-deviation", label:"Protocol deviation review", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Completed review stage",4), numberField('limit',"Required review stage",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"adverse-event", label:"Serious adverse event reporting", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Report age (hours)",6), numberField('limit',"Maximum reporting age",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"database-lock", label:"Study database lock", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Verified forms",4), numberField('limit',"Minimum verified forms",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  }]
const operations:Operation[]=[...workflowOperations("protocol-amendment", "Protocol amendment control", validate0),
...workflowOperations("site-activation", "Site activation", validate1),
...workflowOperations("subject-eligibility", "Subject eligibility", validate2),
...workflowOperations("visit-window", "Protocol visit windows", validate3),
...workflowOperations("enrollment-cap", "Enrollment capacity", validate4),
...workflowOperations("protocol-deviation", "Protocol deviation review", validate5),
...workflowOperations("adverse-event", "Serious adverse event reporting", validate6),
...workflowOperations("database-lock", "Study database lock", validate7)]
const seed:Entity[]=[entity("protocol-amendment-001","protocol-amendment","Protocol amendment control primary record",'review',{owner:"Trial Manager",measured:5,limit:5,evidence:"EV-TRIALFORGE-001",effectiveDate:'2026-09-14'}),
entity("protocol-amendment-002","protocol-amendment","Protocol amendment control recovery record",'blocked',{owner:"Clinical Research Associate",measured:5,limit:5,evidence:"REC-TRIALFORGE-001",effectiveDate:'2026-09-15'}),
entity("site-activation-001","site-activation","Site activation primary record",'review',{owner:"Trial Manager",measured:8,limit:5,evidence:"EV-TRIALFORGE-002",effectiveDate:'2026-09-14'}),
entity("site-activation-002","site-activation","Site activation recovery record",'blocked',{owner:"Clinical Research Associate",measured:8,limit:5,evidence:"REC-TRIALFORGE-002",effectiveDate:'2026-09-15'}),
entity("subject-eligibility-001","subject-eligibility","Subject eligibility primary record",'review',{owner:"Trial Manager",measured:4,limit:8,evidence:"EV-TRIALFORGE-003",effectiveDate:'2026-09-14'}),
entity("subject-eligibility-002","subject-eligibility","Subject eligibility recovery record",'blocked',{owner:"Clinical Research Associate",measured:4,limit:8,evidence:"REC-TRIALFORGE-003",effectiveDate:'2026-09-15'}),
entity("visit-window-001","visit-window","Protocol visit windows primary record",'review',{owner:"Trial Manager",measured:4,limit:8,evidence:"EV-TRIALFORGE-004",effectiveDate:'2026-09-14'}),
entity("visit-window-002","visit-window","Protocol visit windows recovery record",'blocked',{owner:"Clinical Research Associate",measured:4,limit:8,evidence:"REC-TRIALFORGE-004",effectiveDate:'2026-09-15'}),
entity("enrollment-cap-001","enrollment-cap","Enrollment capacity primary record",'review',{owner:"Trial Manager",measured:4,limit:8,evidence:"EV-TRIALFORGE-005",effectiveDate:'2026-09-14'}),
entity("enrollment-cap-002","enrollment-cap","Enrollment capacity recovery record",'blocked',{owner:"Clinical Research Associate",measured:4,limit:8,evidence:"REC-TRIALFORGE-005",effectiveDate:'2026-09-15'}),
entity("protocol-deviation-001","protocol-deviation","Protocol deviation review primary record",'review',{owner:"Trial Manager",measured:8,limit:5,evidence:"EV-TRIALFORGE-006",effectiveDate:'2026-09-14'}),
entity("protocol-deviation-002","protocol-deviation","Protocol deviation review recovery record",'blocked',{owner:"Clinical Research Associate",measured:8,limit:5,evidence:"REC-TRIALFORGE-006",effectiveDate:'2026-09-15'}),
entity("adverse-event-001","adverse-event","Serious adverse event reporting primary record",'review',{owner:"Trial Manager",measured:4,limit:8,evidence:"EV-TRIALFORGE-007",effectiveDate:'2026-09-14'}),
entity("adverse-event-002","adverse-event","Serious adverse event reporting recovery record",'blocked',{owner:"Clinical Research Associate",measured:4,limit:8,evidence:"REC-TRIALFORGE-007",effectiveDate:'2026-09-15'}),
entity("database-lock-001","database-lock","Study database lock primary record",'review',{owner:"Trial Manager",measured:8,limit:5,evidence:"EV-TRIALFORGE-008",effectiveDate:'2026-09-14'}),
entity("database-lock-002","database-lock","Study database lock recovery record",'blocked',{owner:"Clinical Research Associate",measured:8,limit:5,evidence:"REC-TRIALFORGE-008",effectiveDate:'2026-09-15'})]
export const product:Product={name:"TrialForge",description:"Clinical trial operations",accent:"#6D3FC0",actors:roles.map((role,index)=>({id:'actor-'+String(index),name:role,role})),kinds,operations,seed,
 validate:(entities)=>{for(const row of entities){requireThat(kinds.some(kind=>kind.key===row.kind),'Unknown domain record.');requireThat(typeof row.fields['owner']==='string','Every workflow requires accountable ownership.')}},
 metrics:(entities)=>[{label:'Domain records',value:String(entities.length)},{label:'Active controls',value:String(entities.filter(row=>['review','authorized','active','blocked'].includes(row.status)).length)},{label:'Blocked',value:String(entities.filter(row=>row.status==='blocked').length)},{label:'Closed',value:String(entities.filter(row=>row.status==='closed').length)}]}
