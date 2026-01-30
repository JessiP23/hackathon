import { Tool, SchemaConstraint } from '@leanmcp/core'
import axios from 'axios'

class PlaceOrderInput {
    @SchemaConstraint({ description: "Vendor Id" })
    vendorId!: string

    @SchemaConstraint({ description: "Order line items" })
    items!: {
        name: string;
        quantity: number;
        price?: number;
    }[];

    @SchemaConstraint({ description: "Customer phone number" })
    customerPhone!: string;
}

class OrderStatusInput {
    @SchemaConstraint({ description: "Order ID" })
    orderId!: string;
}

export class OrderService {
    @Tool({
        description: "Place an order within a street vendor",
        inputClass: PlaceOrderInput
    })

    async placeOrder(input: PlaceOrderInput) {
        const response = await axios.post(
            `${process.env.BACKEND_URL}/orders`,
            input
        )
        return response.data
    }

    @Tool({
        description: "Get Order Status",
        inputClass: OrderStatusInput
    })
    async getOrderStatus(input: OrderStatusInput) {
        const response = await axios.get(
            `${process.env.BACKEND_URL}/orders/${input.orderId}`,
        )
        return response.data;
    }
}