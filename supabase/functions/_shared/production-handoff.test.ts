import { describe, expect, it } from 'vitest';
import { productionHandoffMetadata } from './production-handoff';
describe('cobertura de impressão', () => {
 it('inclui somente snapshots com revisão e setor correspondentes', () => {
  expect(productionHandoffMetadata([
   { id:'a', handoff_revision:2, production_sector:'KITCHEN' },
   { id:'b', handoff_revision:1, production_sector:'JUICE_POTATO' },
   { id:'c', production_sector:'KITCHEN' },
   { id:'d', handoff_revision:1, production_sector:'KITCHEN', status:'CANCELLED' },
  ],'KITCHEN')).toEqual({handoff_items:[{id:'a',revision:2}]});
 });
 it('não inventa cobertura para legado ou lista vazia',()=>{
  expect(productionHandoffMetadata(null,'KITCHEN')).toEqual({handoff_items:[]});
 });
});
