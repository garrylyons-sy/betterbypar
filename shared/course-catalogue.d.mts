import type {RoundInput} from '../lib/golf-rounds.mjs';
import type {CatalogueCourse,CatalogueTee,CourseDetails} from './course-catalogue';
export type {CatalogueHole,CatalogueCourse,CatalogueTee,CourseCatalogue,CourseDetails} from './course-catalogue';
export function catalogueCourseName(course:Pick<CatalogueCourse,'clubName'|'name'>):string;
export function catalogueSnapshot(course:CatalogueCourse,tee:CatalogueTee):CourseDetails;
export function normalizeCourseDetails(value:unknown):CourseDetails|null;
export function applyCatalogueTee<T extends RoundInput>(round:T,course:CatalogueCourse,tee:CatalogueTee):T;
