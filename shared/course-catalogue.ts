export type CatalogueHole={number:number;par:number;strokeIndex:number|null;distance:number|null};
export type CatalogueTee={id:string;slug:string;name:string;colour:string;ratingCategory:'men'|'women'|'unisex'|'unspecified';par:number;courseRating:number|null;slopeRating:number|null;totalDistance:number|null;distanceUnit:'m'|'yd';sourceUrl:string;reviewedOn:string;holes:CatalogueHole[]};
export type CatalogueCourse={id:string;slug:string;clubName:string;name:string;location:string;sourceUrl:string;reviewedOn:string;tees:CatalogueTee[]};
export type CourseCatalogue={courses:CatalogueCourse[]};
export type CourseDetails={courseId:string;teeId:string;clubName:string;courseName:string;teeName:string;ratingCategory:CatalogueTee['ratingCategory'];par:number;courseRating:number|null;slopeRating:number|null;totalDistance:number|null;distanceUnit:'m'|'yd';sourceUrl:string;reviewedOn:string;ratedHoleCount:18;holes:CatalogueHole[]};
