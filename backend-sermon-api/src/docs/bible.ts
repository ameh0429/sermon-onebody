const location = { type:'object',nullable:true,properties:{ bookId:{type:'string'},chapter:{type:'integer'} } };
export const bibleSchemas = {
  BibleTranslation: { type:'object',properties:{ id:{type:'string',enum:['asv','ylt']},abbreviation:{type:'string'},name:{type:'string'},language:{type:'string'},attribution:{type:'string'},licence:{type:'string',example:'Public domain'},sourceUrl:{type:'string',format:'uri'} } },
  BibleBook: { type:'object',properties:{id:{type:'string',example:'JHN'},name:{type:'string',example:'John'},chapters:{type:'integer',example:21}} },
  BiblePassage: {type:'object',properties:{translation:{$ref:'#/components/schemas/BibleTranslation'},book:{type:'object',properties:{id:{type:'string'},name:{type:'string'}}},chapter:{type:'integer'},reference:{type:'string',example:'John 3:16–18'},fromVerse:{type:'integer',nullable:true},toVerse:{type:'integer',nullable:true},verses:{type:'array',items:{type:'object',properties:{number:{type:'integer'},text:{type:'string'},note:{type:'string',nullable:true}}}},previous:location,next:location}},
};
