import { Tool, SchemaConstraint } from '@leanmcp/core'
import axios from 'axios';

class SearchVendorInput {
    @SchemaConstraint({ description: "Food or product user is looking for" })
    query!: string;

    @SchemaConstraint({ description: 'User latitude' })
    lat!: number;

    @SchemaConstraint({ description: 'User longitude' })
    lng!: number;
}

export class SearchService {
    @Tool({
        description: "Search nearby street vendors by food or product",
        inputClass: SearchVendorInput
    })
    async searchVendors(input: SearchVendorInput) {
        const response = await axios.get(
            `${process.env.BACKEND_URL}/vendors/nearby`,
            {params: input}
        )
        return response.data;
    }
}